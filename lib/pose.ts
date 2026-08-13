// ── Client-side swing pose measurement (MediaPipe Tasks Vision) ──
// Runs entirely in the browser: WASM runtime + pose model are fetched from
// pinned CDNs on first use (cached after), landmarks are computed locally,
// and only a small JSON of measured angles is sent to the analyze API.
// Everything here is best-effort — callers should treat a null return as
// "no pose data" and proceed with frames alone.

import type { PoseLandmarker as PoseLandmarkerT } from "@mediapipe/tasks-vision";

// Pin the WASM CDN to the exact installed package version — runtime and JS
// must match or MediaPipe fails to initialize.
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// BlazePose landmark indices
const NOSE = 0, L_SHOULDER = 11, R_SHOULDER = 12, L_WRIST = 15, R_WRIST = 16, L_HIP = 23, R_HIP = 24;

interface LM {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FramePose {
  frame: number; // 1-based, matches the order frames are sent to the model
  spineTiltDeg: number | null; // forward/side lean of shoulder-to-hip line vs vertical (image plane)
  shoulderTurnDeg: number | null; // rotation vs address, horizontal plane (world landmarks)
  hipTurnDeg: number | null; // rotation vs address, horizontal plane (world landmarks)
  wristHeight: number | null; // 0 = hip level, 1 = above head (normalized, higher = hands higher)
  headSwayPct: number | null; // lateral head drift vs address, % of shoulder width
}

export interface PoseSummary {
  framesAnalyzed: number;
  framesWithPose: number;
  topFrame: number | null; // frame where hands are highest
  spineTiltAtAddressDeg: number | null;
  spineTiltAtTopDeg: number | null;
  shoulderTurnAtTopDeg: number | null;
  hipTurnAtTopDeg: number | null;
  xFactorAtTopDeg: number | null; // shoulder turn minus hip turn at the top
  maxHeadSwayPct: number | null;
  frames: FramePose[];
}

/** The compact subset persisted to swing memory for numeric trend tracking. */
export function summaryMetrics(s: PoseSummary): Record<string, number | null> {
  return {
    shoulderTurnAtTopDeg: s.shoulderTurnAtTopDeg,
    hipTurnAtTopDeg: s.hipTurnAtTopDeg,
    xFactorAtTopDeg: s.xFactorAtTopDeg,
    spineTiltAtAddressDeg: s.spineTiltAtAddressDeg,
    spineTiltAtTopDeg: s.spineTiltAtTopDeg,
    maxHeadSwayPct: s.maxHeadSwayPct,
  };
}

let landmarkerPromise: Promise<PoseLandmarkerT> | null = null;

function getLandmarker(): Promise<PoseLandmarkerT> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
      try {
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "IMAGE",
          numPoses: 1,
        });
      } catch {
        // Some browsers/GPUs reject the GPU delegate — retry on CPU.
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "IMAGE",
          numPoses: 1,
        });
      }
    })().catch((e) => {
      landmarkerPromise = null; // allow retry next time
      throw e;
    });
  }
  return landmarkerPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("frame decode failed"));
    img.src = src;
  });
}

const deg = (r: number) => (r * 180) / Math.PI;
const r1 = (n: number) => Math.round(n * 10) / 10;
const mid = (a: LM, b: LM) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

function visible(lms: LM[], idxs: number[], min = 0.5): boolean {
  return idxs.every((i) => (lms[i]?.visibility ?? 1) >= min);
}

/** Angle of the shoulder→hip line vs vertical, in the image plane. */
function spineTilt(lms: LM[]): number | null {
  if (!visible(lms, [L_SHOULDER, R_SHOULDER, L_HIP, R_HIP])) return null;
  const ms = mid(lms[L_SHOULDER], lms[R_SHOULDER]);
  const mh = mid(lms[L_HIP], lms[R_HIP]);
  const dy = mh.y - ms.y; // image y grows downward; hips below shoulders → dy > 0
  if (dy <= 0.01) return null; // degenerate (lying down / bad detection)
  return r1(deg(Math.atan2(Math.abs(ms.x - mh.x), dy)));
}

/** Angle of a left→right body line in the horizontal (x-z) plane, world coords. */
function lineAngleXZ(a: LM, b: LM): number {
  return deg(Math.atan2(b.z - a.z, b.x - a.x));
}

/** Smallest signed difference between two angles, in degrees. */
function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * Measure body positions across swing frames (base64 data URLs, in order).
 * Returns null if the pose runtime can't load or no frames contain a person.
 */
export async function measureSwing(frames: string[]): Promise<PoseSummary | null> {
  let landmarker: PoseLandmarkerT;
  try {
    landmarker = await getLandmarker();
  } catch {
    return null; // offline / CDN blocked / unsupported browser — degrade silently
  }

  interface Raw {
    frame: number;
    lms: LM[]; // normalized image landmarks
    world: LM[]; // metric world landmarks
  }
  const raws: Raw[] = [];
  for (let i = 0; i < frames.length; i++) {
    try {
      const img = await loadImage(frames[i]);
      const res = landmarker.detect(img);
      const lms = res.landmarks?.[0] as LM[] | undefined;
      const world = res.worldLandmarks?.[0] as LM[] | undefined;
      if (lms?.length && world?.length) raws.push({ frame: i + 1, lms, world });
    } catch {
      /* skip undetectable frames */
    }
  }
  if (!raws.length) return null;

  // Address reference = first frame with a pose (motion window starts at takeaway).
  const address = raws[0];
  const addrShoulderAngle = lineAngleXZ(address.world[L_SHOULDER], address.world[R_SHOULDER]);
  const addrHipAngle = lineAngleXZ(address.world[L_HIP], address.world[R_HIP]);
  const addrNoseX = address.lms[NOSE]?.x ?? null;
  const addrShoulderWidth = Math.abs(address.lms[L_SHOULDER].x - address.lms[R_SHOULDER].x) || null;

  const framePoses: FramePose[] = raws.map((r) => {
    const shoulderOk = visible(r.lms, [L_SHOULDER, R_SHOULDER]);
    const hipOk = visible(r.lms, [L_HIP, R_HIP]);
    const wristOk = visible(r.lms, [L_WRIST, R_WRIST], 0.4);

    // Hands height: 0 at hip level, 1 at head level (nose), can exceed either side.
    let wristHeight: number | null = null;
    if (wristOk && hipOk) {
      const hipY = mid(r.lms[L_HIP], r.lms[R_HIP]).y;
      const noseY = r.lms[NOSE]?.y ?? hipY - 0.35;
      const span = hipY - noseY;
      if (span > 0.05) {
        const wristY = Math.min(r.lms[L_WRIST].y, r.lms[R_WRIST].y);
        wristHeight = r1((hipY - wristY) / span);
      }
    }

    let headSwayPct: number | null = null;
    const noseX = r.lms[NOSE]?.x;
    if (noseX != null && addrNoseX != null && addrShoulderWidth) {
      headSwayPct = r1((Math.abs(noseX - addrNoseX) / addrShoulderWidth) * 100);
    }

    return {
      frame: r.frame,
      spineTiltDeg: spineTilt(r.lms),
      shoulderTurnDeg: shoulderOk
        ? r1(Math.abs(angleDelta(addrShoulderAngle, lineAngleXZ(r.world[L_SHOULDER], r.world[R_SHOULDER]))))
        : null,
      hipTurnDeg: hipOk
        ? r1(Math.abs(angleDelta(addrHipAngle, lineAngleXZ(r.world[L_HIP], r.world[R_HIP]))))
        : null,
      wristHeight,
      headSwayPct,
    };
  });

  // Top of backswing = frame where the hands are highest.
  let top: FramePose | null = null;
  for (const f of framePoses) {
    if (f.wristHeight == null) continue;
    if (!top || f.wristHeight > (top.wristHeight ?? -Infinity)) top = f;
  }

  const addressPose = framePoses[0];
  const xFactor =
    top && top.shoulderTurnDeg != null && top.hipTurnDeg != null
      ? r1(top.shoulderTurnDeg - top.hipTurnDeg)
      : null;
  const sways = framePoses.map((f) => f.headSwayPct).filter((v): v is number => v != null);

  return {
    framesAnalyzed: frames.length,
    framesWithPose: raws.length,
    topFrame: top?.frame ?? null,
    spineTiltAtAddressDeg: addressPose?.spineTiltDeg ?? null,
    spineTiltAtTopDeg: top?.spineTiltDeg ?? null,
    shoulderTurnAtTopDeg: top?.shoulderTurnDeg ?? null,
    hipTurnAtTopDeg: top?.hipTurnDeg ?? null,
    xFactorAtTopDeg: xFactor,
    maxHeadSwayPct: sways.length ? Math.max(...sways) : null,
    frames: framePoses,
  };
}

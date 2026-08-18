"use client";

import React, { useEffect, useRef, useState } from "react";
import { THEMES, Slot, Drill } from "@/lib/caddie-data";
import { DeviceFrame } from "./DeviceFrame";
import { Cover } from "./Cover";
import { BagView } from "./BagView";
import { SlotDetail } from "./SlotDetail";
import { DrillView } from "./DrillView";
import { InsightsView } from "./InsightsView";
import { UploadView } from "./UploadView";
import { CourseBook } from "./CourseBook";
import { ProfileView } from "./ProfileView";
import { TabBar } from "./TabBar";
import { GradesProvider } from "./GradesContext";
import { RoundDetail } from "./RoundDetail";
import { CourseDetail } from "./CourseDetail";
import { CoachChat } from "./CoachChat";
import { useIsDesktop } from "./useIsDesktop";
import { DesktopShell } from "./desktop/DesktopShell";
import type { RoundSummary } from "./types";
import { normalizeSlug, onPopView, pushView, type ViewSlug } from "./urlView";

const TAB_ORDER = ["bag", "feed", "upload", "courses", "you"];

// URL slug for each mobile tab (the "feed" tab is Insights, "you" is Profile).
const TAB_SLUG: Record<string, ViewSlug> = {
  bag: "bag",
  feed: "insights",
  upload: "upload",
  courses: "courses",
  you: "profile",
};

// Initial mobile state for a URL slug. Desktop-only slugs map to the nearest
// mobile equivalent; /coach opens the chat overlay on top of Insights.
function mobileStateFromSlug(slug: ViewSlug | ""): { tab: string; chat: boolean } {
  switch (slug) {
    case "insights":
      return { tab: "feed", chat: false };
    case "upload":
      return { tab: "upload", chat: false };
    case "courses":
    case "rounds":
      return { tab: "courses", chat: false };
    case "profile":
      return { tab: "you", chat: false };
    case "coach":
      return { tab: "feed", chat: true };
    default:
      return { tab: "bag", chat: false };
  }
}

type StackEntry =
  | { kind: "slot"; data: Slot }
  | { kind: "drill"; data: Drill }
  | { kind: "round"; data: RoundSummary }
  | { kind: "course"; data: string }
  | { kind: "chat" };

function App({ initialView = "" }: { initialView?: ViewSlug | "" }) {
  const [theme] = useState<"dark" | "light">("dark");
  const [layout] = useState("grid");
  const [heatmap] = useState("subtle");
  const initial = mobileStateFromSlug(initialView);
  const [tab, setTab] = useState(initial.tab);
  const [stack, setStack] = useState<StackEntry[]>(initial.chat ? [{ kind: "chat" }] : []);
  const [doneDrills, setDoneDrills] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number; t: number; ignored: boolean } | null>(null);

  const GOLD = "#F0C040";

  const top = stack[stack.length - 1];
  const pushSlot = (slot: Slot) => setStack((s) => [...s, { kind: "slot", data: slot }]);
  const pushDrill = (drill: Drill) => setStack((s) => [...s, { kind: "drill", data: drill }]);
  const pushRound = (r: RoundSummary) => setStack((s) => [...s, { kind: "round", data: r }]);
  const pushCourse = (c: string) => setStack((s) => [...s, { kind: "course", data: c }]);
  const pushChat = () => {
    setStack((s) => [...s, { kind: "chat" }]);
    pushView("coach");
  };
  const back = () => {
    if (top?.kind === "chat") pushView(TAB_SLUG[tab] ?? "bag");
    setStack((s) => s.slice(0, -1));
  };
  const goTab = (tb: string) => {
    setStack([]);
    setTab(tb);
    pushView(TAB_SLUG[tb] ?? "bag");
  };

  // Browser back/forward: restore the tab (and chat overlay) for the URL.
  useEffect(
    () =>
      onPopView((slug) => {
        const st = mobileStateFromSlug(slug);
        setTab(st.tab);
        setStack(st.chat ? [{ kind: "chat" }] : []);
      }),
    []
  );

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab, stack.length]);

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    const ignored = !!(e.target as HTMLElement).closest(".leaflet-container, [data-noswipe]");
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), ignored };
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const touch = touchRef.current;
    touchRef.current = null;
    if (!touch || touch.ignored) return;
    const changedTouch = e.changedTouches[0];
    const dx = changedTouch.clientX - touch.x;
    const dy = changedTouch.clientY - touch.y;
    const elapsed = Date.now() - touch.t;
    if (Math.abs(dx) <= 70 || Math.abs(dx) <= Math.abs(dy) * 2 || elapsed >= 600) return;
    if (stack.length > 0) {
      // In overlay: right swipe = back
      if (dx > 0) back();
    } else {
      // On tab: left = next, right = prev
      const idx = TAB_ORDER.indexOf(tab);
      if (dx < 0 && idx < TAB_ORDER.length - 1) goTab(TAB_ORDER[idx + 1]);
      else if (dx > 0 && idx > 0) goTab(TAB_ORDER[idx - 1]);
    }
  }

  const vars = {
    ...THEMES[theme],
    "--gold": GOLD,
    "--good": "#4CAF82",
    "--bad": "#C05C5C",
    "--font-display": "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    "--font-ui": "'Inter', system-ui, sans-serif",
    "--font-mono": "'IBM Plex Mono', ui-monospace, monospace",
  } as React.CSSProperties;

  let content: React.ReactNode;
  let overlayKey: string;
  if (top) {
    overlayKey =
      top.kind +
      (top.kind === "chat" ? "" : typeof top.data === "string" ? top.data : (top.data as { id?: string }).id || "");
    if (top.kind === "slot") {
      content = <SlotDetail slot={top.data as Slot} onBack={back} onOpenDrill={pushDrill} />;
    } else if (top.kind === "drill") {
      const d = top.data as Drill;
      content = <DrillView drill={d} onBack={back} onOpenSlot={pushSlot} done={!!doneDrills[d.id]} onToggleDone={() => setDoneDrills((prev) => ({ ...prev, [d.id]: !prev[d.id] }))} />;
    } else if (top.kind === "round") {
      content = <RoundDetail round={top.data as RoundSummary} onBack={back} />;
    } else if (top.kind === "chat") {
      content = <CoachChat onBack={back} />;
    } else {
      content = <CourseDetail course={top.data as string} onBack={back} onOpenRound={pushRound} />;
    }
  } else {
    overlayKey = "tab-" + tab;
    if (tab === "bag") content = <BagView layout={layout} heatmap={heatmap} onOpenSlot={pushSlot} onOpenDrill={pushDrill} onUpload={() => goTab("upload")} />;
    else if (tab === "feed") content = <InsightsView onOpenSlot={pushSlot} onOpenChat={pushChat} />;
    else if (tab === "upload") content = <UploadView onParsed={() => goTab("bag")} onOpenInsights={() => goTab("feed")} />;
    else if (tab === "courses") content = <CourseBook onOpenRound={pushRound} onOpenCourse={pushCourse} />;
    else content = <ProfileView />;
  }

  const isChat = top?.kind === "chat";

  return (
    <GradesProvider>
      <DeviceFrame dark={theme === "dark"}>
        <div style={{ ...vars, position: "absolute", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column", color: "var(--cream)" }}>
          {isChat ? (
            // Chat manages its own scroll + pinned composer — fill the flex area,
            // no outer scroll. Still clear the OS status bar / notch.
            <div key={overlayKey} className="sc-overlay" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
              {content}
            </div>
          ) : (
            <div ref={scrollRef} className="sc-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0, paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              <div key={overlayKey} className={top ? "sc-overlay" : "sc-view"}>
                {content}
              </div>
            </div>
          )}
          <TabBar tab={tab} onTab={goTab} gold={GOLD} />
        </div>
      </DeviceFrame>
    </GradesProvider>
  );
}

export default function CaddieApp({ initialView = "" }: { initialView?: string }) {
  const [entered, setEntered] = useState(false);
  const { isDesktop, ready } = useIsDesktop();
  const view = normalizeSlug(initialView);

  // Desktop (>=1024px): skip the mobile Cover/passcode entirely and render
  // the full desktop shell. `ready` guards against a flash of the mobile
  // shell before the client-only matchMedia check has run (SSR/first paint
  // always reports isDesktop=false).
  if (ready && isDesktop) {
    return (
      <GradesProvider>
        <DesktopShell initialView={view} />
      </GradesProvider>
    );
  }

  return entered ? <App initialView={view} /> : <Cover onEnter={() => setEntered(true)} />;
}

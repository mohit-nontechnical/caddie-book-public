import { useCallback, useEffect, useState } from "react";
import { COACH_STYLES, DEFAULT_STYLE, type CoachStyleId } from "@/lib/coach-styles";

const STORAGE_KEY = "caddie.coachStyle";

function isValidStyle(v: string | null): v is CoachStyleId {
  return !!v && Object.prototype.hasOwnProperty.call(COACH_STYLES, v);
}

function readStored(): CoachStyleId {
  if (typeof window === "undefined") return DEFAULT_STYLE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isValidStyle(raw) ? raw : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

/**
 * Non-hook accessor for fetch call sites outside render (event handlers,
 * imperative POST bodies). SSR-safe — returns the default on the server.
 */
export function getCoachStyle(): CoachStyleId {
  return readStored();
}

/**
 * React hook: reads/writes the "caddie.coachStyle" localStorage key.
 * SSR-safe — starts at DEFAULT_STYLE and syncs to the stored value after
 * mount, so server and first client render always match (no hydration
 * mismatch), then the picker reflects the real saved choice.
 */
export function useCoachStyle(): [CoachStyleId, (id: CoachStyleId) => void] {
  const [style, setStyleState] = useState<CoachStyleId>(DEFAULT_STYLE);

  useEffect(() => {
    setStyleState(readStored());
  }, []);

  const setStyle = useCallback((id: CoachStyleId) => {
    setStyleState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* best-effort persistence only */
    }
  }, []);

  return [style, setStyle];
}

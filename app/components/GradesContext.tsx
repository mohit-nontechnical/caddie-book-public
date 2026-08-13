"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Grade } from "@/lib/caddie-data";

type Overrides = Record<string, Grade>;

interface GradesCtx {
  /** Effective grade for a slot: a live override if present, else the seed grade. */
  gradeFor: (id: string, fallback: Grade) => Grade;
  /** Merge a batch of {id, grade} from the coach route into the live overrides. */
  applyGrades: (list: { id: string; grade: string }[]) => void;
  overrides: Overrides;
  hasOverrides: boolean;
  reset: () => void;
}

const Ctx = createContext<GradesCtx | null>(null);
const KEY = "caddie:grades";
const VALID: Grade[] = ["A", "B", "C", "D", "F"];

export function GradesProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>({});

  // Restore live grades: localStorage first (instant), then server (authoritative).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setOverrides(JSON.parse(raw) as Overrides);
    } catch {
      /* ignore */
    }
    fetch("/api/grades")
      .then((r) => r.json())
      .then((d) => {
        const g = d?.grades as Overrides | undefined;
        if (g && Object.keys(g).length) {
          setOverrides((prev) => {
            const next = { ...prev, ...g };
            try {
              localStorage.setItem(KEY, JSON.stringify(next));
            } catch {
              /* ignore */
            }
            return next;
          });
        }
      })
      .catch(() => {});
  }, []);

  const gradeFor = useCallback(
    (id: string, fallback: Grade) => overrides[id] ?? fallback,
    [overrides]
  );

  const applyGrades = useCallback((list: { id: string; grade: string }[]) => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const { id, grade } of list || []) {
        const g = String(grade).toUpperCase() as Grade;
        if (id && VALID.includes(g)) next[id] = g;
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setOverrides({});
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <Ctx.Provider value={{ gradeFor, applyGrades, overrides, hasOverrides: Object.keys(overrides).length > 0, reset }}>
      {children}
    </Ctx.Provider>
  );
}

// Safe even outside a provider (e.g. the Cover screen) — falls back to seed grades.
export function useGrades(): GradesCtx {
  return (
    useContext(Ctx) ?? {
      gradeFor: (_id, f) => f,
      applyGrades: () => {},
      overrides: {},
      hasOverrides: false,
      reset: () => {},
    }
  );
}

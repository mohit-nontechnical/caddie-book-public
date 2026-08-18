// Deep-linkable pages: the whole app is served by the optional catch-all
// route app/[[...view]]/page.tsx, and these helpers map the client-side
// navigation state (mobile tab/chat overlay, desktop route) to URL paths
// (/insights, /rounds, /coach, ...) via pushState/popstate — so links are
// shareable, refresh restores the page, and back/forward work.

export type ViewSlug =
  | "dashboard"
  | "rounds"
  | "insights"
  | "courses"
  | "bag"
  | "coach"
  | "profile"
  | "upload";

const KNOWN: ReadonlyArray<string> = [
  "dashboard",
  "rounds",
  "insights",
  "courses",
  "bag",
  "coach",
  "profile",
  "upload",
];

// Accepts a raw path or path segment; returns the canonical slug, or "" for
// the root / anything unknown. Aliases: "you" (mobile tab id) → profile,
// "feed" (mobile tab id) → insights.
export function normalizeSlug(raw: string | undefined | null): ViewSlug | "" {
  const s = (raw ?? "").replace(/^\//, "").split("/")[0].toLowerCase();
  if (s === "you") return "profile";
  if (s === "feed") return "insights";
  return KNOWN.includes(s) ? (s as ViewSlug) : "";
}

export function isKnownSlug(raw: string | undefined | null): boolean {
  return normalizeSlug(raw) !== "";
}

export function pushView(slug: ViewSlug) {
  if (typeof window === "undefined") return;
  const path = "/" + slug;
  if (window.location.pathname !== path) {
    window.history.pushState({ view: slug }, "", path);
  }
}

// Subscribe to browser back/forward. Returns the cleanup function.
export function onPopView(handler: (slug: ViewSlug | "") => void): () => void {
  const fn = () => handler(normalizeSlug(window.location.pathname));
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
}

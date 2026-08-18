"use client";

import { useState } from "react";

// Fetches the player-profile PNG from /api/share-card and hands it to the
// native share sheet when available (mobile → straight into iMessage/
// WhatsApp/etc), otherwise downloads it. Shared by ProfileView (mobile)
// and DesktopProfile.
export function useShareCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function share() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/share-card");
      if (!res.ok) throw new Error("Couldn't build your card");
      const blob = await res.blob();
      const file = new File([blob], "caddie-book-player-card.png", { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "My Caddie Book player card" });
          return;
        } catch (e) {
          // AbortError = user closed the share sheet; nothing to do.
          if (e instanceof Error && e.name === "AbortError") return;
          // Any other share failure falls through to download.
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "caddie-book-player-card.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return { share, busy, error };
}

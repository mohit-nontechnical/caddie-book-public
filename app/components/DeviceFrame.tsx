import React from "react";

// A plain, responsive app shell.
//
// On phones this is a full-bleed mobile website that fills the real viewport
// and respects the OS safe-area insets (notch / home indicator). On wider
// screens it constrains to a centered phone-width column so the layout doesn't
// stretch awkwardly — but with NO fake status bar, NO fake clock, and NO bezel.
// The browser/OS provides the real status bar and time.
export function DeviceFrame({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="cb-frame" style={{ background: dark ? "#000" : "#F2F2F7" }}>
      {children}
    </div>
  );
}

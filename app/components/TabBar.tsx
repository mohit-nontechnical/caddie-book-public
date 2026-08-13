import React from "react";
import { IconBag, IconFlag, IconMap, IconUser, IconUpload } from "./icons";

type Item = { key: string; label: string; Icon?: (p: { size?: number; stroke?: string; sw?: number }) => React.JSX.Element; center?: boolean };

export const TabBar = ({ tab, onTab, gold }: { tab: string; onTab: (t: string) => void; gold: string }) => {
  const items: Item[] = [
    { key: "bag", label: "The Bag", Icon: IconBag },
    { key: "feed", label: "Insights", Icon: IconFlag },
    { key: "upload", label: "Upload", center: true },
    { key: "courses", label: "Courses", Icon: IconMap },
    { key: "you", label: "You", Icon: IconUser },
  ];
  return (
    <div style={{ flexShrink: 0, position: "relative", zIndex: 40 }}>
      <div style={{ background: "var(--tabbar)", backdropFilter: "blur(18px) saturate(180%)", WebkitBackdropFilter: "blur(18px) saturate(180%)", borderTop: "1px solid var(--line)", display: "flex", alignItems: "flex-start", padding: "9px 8px calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
        {items.map((it) => {
          if (it.center) {
            const active = tab === "upload";
            return (
              <button key={it.key} onClick={() => onTab("upload")} className="sc-press sc-tabbtn" style={{ marginTop: -2 }}>
                <span style={{ width: 46, height: 46, borderRadius: 16, background: gold, display: "grid", placeItems: "center", boxShadow: "0 8px 20px -8px " + gold + "cc, inset 0 1px 0 rgba(255,255,255,0.3)", transform: active ? "translateY(-1px)" : "none" }}>
                  <IconUpload size={23} stroke="#0F2016" sw={2.1} />
                </span>
              </button>
            );
          }
          const active = tab === it.key;
          const col = active ? gold : "var(--cream-3)";
          const I = it.Icon!;
          return (
            <button key={it.key} onClick={() => onTab(it.key)} className="sc-tabbtn">
              <I size={23} stroke={col} sw={active ? 2 : 1.7} />
              <span className="sc-tablabel" style={{ color: col }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

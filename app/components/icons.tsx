import React from "react";

type IconProps = {
  d?: string;
  size?: number;
  stroke?: string;
  sw?: number;
  fill?: string;
  children?: React.ReactNode;
  vb?: number;
};

export const Icon = ({ d, size = 24, stroke = "currentColor", sw = 1.75, fill = "none", children, vb = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

export const IconBag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 8l1-3.2A2 2 0 019.9 3.3h1.2A2 2 0 0113 4.8L14 8" />
    <rect x="5.5" y="8" width="11" height="12.5" rx="3" />
    <path d="M9 8v-1M12 8v-1.6M15 8v-1.2" />
    <path d="M16.5 11.5h2.2A1.3 1.3 0 0120 12.8v3" />
  </Icon>
);
export const IconFlag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 21V4" />
    <path d="M6 5h11l-2.2 3L17 11H6" />
    <circle cx="6" cy="21" r="0.6" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconTarget = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="4.4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16V5" />
    <path d="M7.5 9.5L12 5l4.5 4.5" />
    <path d="M5 18.5h14" />
  </Icon>
);
export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5.5 20a6.5 6.5 0 0113 0" />
  </Icon>
);
export const IconChevron = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
export const IconArrowL = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const IconScan = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8V6.5A2.5 2.5 0 016.5 4H8M16 4h1.5A2.5 2.5 0 0120 6.5V8M20 16v1.5a2.5 2.5 0 01-2.5 2.5H16M8 20H6.5A2.5 2.5 0 014 17.5V16" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const IconPlay = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconSpark = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6z" />
  </Icon>
);
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4.3l2.8 1.7" />
  </Icon>
);
export const IconMap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" />
    <path d="M9 4v13M15 7v13" />
  </Icon>
);
export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </Icon>
);

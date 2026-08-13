import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caddie Book by Mo",
    short_name: "Caddie Book",
    description: "Your AI golf caddie — learns your game and finds what's costing you strokes.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A1A0E",
    theme_color: "#0F2016",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

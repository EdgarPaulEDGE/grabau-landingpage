import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Moderne Formate für kleinere Dateien und schnelleres Laden
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// размещение под подпутём домена (dchr.koinotinav.com/tek): задаётся при сборке образа
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") || undefined;

const nextConfig: NextConfig = {
  basePath,
  // картинки — готовые SVG/webp из /public и /art: отдаём как есть; под basePath их префиксует свой loader
  images: basePath ? { loader: "custom", loaderFile: "./src/lib/image-loader.ts" } : { unoptimized: true },
  // dev server is reached through 127.0.0.1 / docker bridge as well as localhost
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.17.0.1"],
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  reactStrictMode: true,
  // базовые заголовки безопасности (HSTS ставит reverse proxy с TLS)
  async headers() {
    return [
      {
        // картинки из /public меняются только с релизом — кешируем на неделю
        source: "/:dir(figma|products|brands|brand|corporate|categories|banners|news|projects|services|configurators)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

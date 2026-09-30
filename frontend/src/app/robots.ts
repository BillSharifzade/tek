import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { asset } from "@/lib/asset";

/** Личные и служебные страницы не индексируются; карта сайта — /sitemap.xml. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: asset("/"), disallow: ["/account", "/cart", "/checkout", "/payment", "/login", "/register", "/search", "/art/"].map(asset) },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}

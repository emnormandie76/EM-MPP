import type { MetadataRoute } from "next";

// Private site: nothing may be indexed.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}

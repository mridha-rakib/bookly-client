import type { NextConfig } from "next";

const allowDevelopmentImages = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // The existing dev filesystem cache opens over 150,000 file handles on Windows.
    turbopackFileSystemCacheForDev: false,
  },
  images: {
    // Permit loopback MinIO only during explicit local development. Production
    // and other modes keep Next's private-network image protection enabled.
    dangerouslyAllowLocalIP: allowDevelopmentImages,
    
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      ...(allowDevelopmentImages
        ? [
            { protocol: "http" as const, hostname: "127.0.0.1", port: "9000" },
            { protocol: "http" as const, hostname: "localhost", port: "9000" },
          ]
        : []),
      {
        // Production business media: Hetzner S3-compatible Object Storage
        // (S3_ENDPOINT in api/.env). Path-style presigned URLs like
        // https://hel1.your-objectstorage.com/<bucket>/businesses/.../media/....png?X-Amz-...
        // The X-Amz-* query params rotate on every fetch, so no `search`/`pathname` is pinned.
        protocol: "https",
        hostname: "hel1.your-objectstorage.com",
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Business media is served from a self-hosted S3-compatible store (MinIO in dev,
    // reachable only via loopback/private hostnames). Next 16 blocks image optimization
    // for any remote host resolving to a private IP unless explicitly opted in — see
    // "Local IP Restriction" in the v16 upgrade guide. remotePatterns below already scope
    // this to the storage host/port, so this only unlocks fetching from that allow-listed
    // origin, not arbitrary local IPs.
    dangerouslyAllowLocalIP: true,
    
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "9000",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
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

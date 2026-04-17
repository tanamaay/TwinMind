import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid incorrect workspace root inference on Windows machines with other lockfiles.
    root: __dirname,
  },
};

export default nextConfig;

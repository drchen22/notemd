import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // allowedDevOrigins is a dev-only feature (validates the Origin/Host header
    // when accessing the dev server from a non-localhost origin). Read from env
    // so internal IPs aren't committed to the repo.
    ...(process.env.DEV_ORIGIN ? { allowedDevOrigins: [process.env.DEV_ORIGIN] } : {}),
    experimental: {
        optimizePackageImports: ["lucide-react"],
    },
};

export default nextConfig;

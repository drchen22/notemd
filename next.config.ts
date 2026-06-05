import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: ["83.229.124.231"],
    experimental: {
        optimizePackageImports: ["lucide-react"],
    },
};

export default nextConfig;

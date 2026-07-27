import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // lucide-react is a barrel file; without this every icon import pulls the
    // whole set into the module graph, inflating both bundle size and the
    // type-check surface (frontend-principles §5).
    optimizePackageImports: ["lucide-react"],
    // TypeScript 7 is the native (Go) compiler and no longer exposes the JS
    // compiler API Next.js drives in-process. This routes type checking through
    // the `tsc` CLI instead. Required for TS 7; remove if reverting to 5.x/6.x.
    useTypeScriptCli: true,
  },
};

export default nextConfig;

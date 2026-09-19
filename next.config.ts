import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The project previously set typescript.ignoreBuildErrors, which hid 35 type
  // errors from the build. It typechecks now, so the build enforces it.
  typedRoutes: false,
};

export default nextConfig;

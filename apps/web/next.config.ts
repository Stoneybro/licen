import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  serverExternalPackages: ["@0gfoundation/0g-ts-sdk", "ethers"],
};

export default withMDX(nextConfig);

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["osmtogeojson", "@xmldom/xmldom"],
};

export default nextConfig;

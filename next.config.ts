import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["osmtogeojson", "@xmldom/xmldom"],
};

export default nextConfig;

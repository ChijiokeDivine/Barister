import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Node.js-native libraries: keep them out of the bundler and load them
  // via native `require` in Server Components / Route Handlers.
  serverExternalPackages: ["wink-nlp", "wink-eng-lite-web-model", "unpdf", "mammoth"],
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

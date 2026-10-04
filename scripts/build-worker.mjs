import { build } from "esbuild";
await build({
  entryPoints: ["src/camera/tracking.worker.ts"],
  outfile: "public/tracking-worker.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
});

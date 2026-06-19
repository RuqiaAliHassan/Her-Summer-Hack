// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Scandit BarcodeAr requires SharedArrayBuffer (cross-origin isolation).
// We send COOP+COEP on every dev response. We use 'credentialless' so that
// images/fonts loaded from third-party CDNs (jsDelivr, Google Fonts) still work.
const crossOriginIsolation = {
  name: "scandit-coop-coep",
  configureServer(server: { middlewares: { use: (fn: (req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      next();
    });
  },
  configurePreviewServer(server: { middlewares: { use: (fn: (req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      next();
    });
  },
};

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [crossOriginIsolation],
  },
});

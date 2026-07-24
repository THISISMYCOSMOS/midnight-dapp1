// SPDX-License-Identifier: Apache-2.0

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  cacheDir: "./.vite",
  define: {
    "process.env": {},
  },
  build: {
    target: "esnext",
    minify: false,
    commonjsOptions: {
      transformMixedEsModules: true,
      ignoreDynamicRequires: true,
    },
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("onchain-runtime-v3") ? "wasm" : undefined,
      },
    },
  },
  plugins: [
    react(),
    wasm(),
    topLevelAwait({
      promiseExportName: "__tla",
      promiseImportName: (index) => `__tla_${index}`,
    }),
  ],
  optimizeDeps: {
    exclude: [
      "@midnight-ntwrk/onchain-runtime-v3",
      "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm",
      "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm.js",
    ],
  },
  resolve: {
    dedupe: ["@midnight-ntwrk/compact-js"],
    alias: [
      // midnight-js-protocol only re-exports compact-js. Resolve both public
      // paths to the same module so compact-js's module-local context Symbol
      // is not duplicated by Vite's dependency optimizer.
      {
        find: /^@midnight-ntwrk\/midnight-js-protocol\/compact-js(\/.*)?$/,
        replacement: "@midnight-ntwrk/compact-js$1",
      },
      { find: "assert", replacement: "assert/" },
    ],
  },
});

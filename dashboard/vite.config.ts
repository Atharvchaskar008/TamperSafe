import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The read layer loads deployments/*.json and deployments/abi/*.json from
// outside this package's root (they live at the repo root, one level above
// dashboard/). Vite's dev server refuses to serve files outside its project
// root by default, so we widen the allow-list to the repo root.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [".."],
    },
  },
});

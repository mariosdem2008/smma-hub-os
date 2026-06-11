import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;

          const normalizedId = id.replace(/\\/g, "/");

          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/react-router-dom/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          if (
            normalizedId.includes("/node_modules/@radix-ui/") ||
            normalizedId.includes("/node_modules/cmdk/") ||
            normalizedId.includes("/node_modules/vaul/")
          ) {
            return "vendor-radix-ui";
          }

          if (
            normalizedId.includes("/node_modules/recharts/") ||
            normalizedId.includes("/node_modules/d3-") ||
            normalizedId.includes("/node_modules/victory-vendor/")
          ) {
            return "vendor-recharts";
          }

          if (
            normalizedId.includes("/node_modules/@tanstack/react-query/") ||
            normalizedId.includes("/node_modules/@tanstack/query-core/")
          ) {
            return "vendor-query";
          }

          if (normalizedId.includes("/node_modules/@supabase/")) {
            return "vendor-supabase";
          }

          if (normalizedId.includes("/node_modules/lucide-react/") || normalizedId.includes("/node_modules/react-icons/")) {
            return "vendor-icons";
          }

          if (normalizedId.includes("/node_modules/framer-motion/")) {
            return "vendor-motion";
          }

          if (
            normalizedId.includes("/node_modules/react-hook-form/") ||
            normalizedId.includes("/node_modules/@hookform/") ||
            normalizedId.includes("/node_modules/zod/")
          ) {
            return "vendor-forms";
          }

          if (
            normalizedId.includes("/node_modules/react-markdown/") ||
            normalizedId.includes("/node_modules/remark-") ||
            normalizedId.includes("/node_modules/micromark") ||
            normalizedId.includes("/node_modules/unified/")
          ) {
            return "vendor-markdown";
          }

          if (
            normalizedId.includes("/node_modules/date-fns/") ||
            normalizedId.includes("/node_modules/date-fns-tz/")
          ) {
            return "vendor-date";
          }

          if (normalizedId.includes("/node_modules/@hello-pangea/dnd/")) {
            return "vendor-dnd";
          }

          return "vendor";
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function getNodeModulePackageName(id: string): string | null {
  const normalized = id.replace(/\\/g, "/");
  const marker = "/node_modules/";
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return null;
  let sub = normalized.slice(idx + marker.length);
  // Support nested package-manager layouts like:
  // .../node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/...
  if (sub.startsWith(".pnpm/")) {
    const nestedMarker = "/node_modules/";
    const nestedIdx = sub.indexOf(nestedMarker);
    if (nestedIdx !== -1) {
      sub = sub.slice(nestedIdx + nestedMarker.length);
    }
  }
  const parts = sub.split("/");
  if (!parts.length) return null;
  if (parts[0].startsWith("@") && parts.length > 1) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          const pkg = getNodeModulePackageName(id);
          if (!pkg) return "vendor-misc";

          if (pkg === "react" || pkg === "react-dom" || pkg === "scheduler") return "vendor-react";
          if (pkg === "react-router" || pkg === "react-router-dom") return "vendor-router";
          if (pkg === "@tanstack/react-query") return "vendor-query";
          if (pkg === "@supabase/supabase-js" || pkg === "@supabase/auth-js" || pkg === "@supabase/postgrest-js")
            return "vendor-supabase";
          if (pkg.startsWith("@radix-ui/")) return "vendor-radix";
          if (pkg === "react-icons" || pkg === "@heroicons/react") return "vendor-icons-extra";
          if (pkg === "recharts" || pkg.startsWith("d3-")) return "vendor-charts";
          if (pkg === "date-fns") return "vendor-date";
          if (pkg === "date-fns-tz") return "vendor-date-tz";
          if (pkg === "react-hook-form" || pkg === "@hookform/resolvers") return "vendor-forms";
          if (pkg === "lucide-react" || pkg === "@radix-ui/react-icons") return "vendor-icons";
          if (pkg === "framer-motion") return "vendor-motion";
          if (pkg === "react-day-picker") return "vendor-daypicker";
          if (pkg === "zod") return "vendor-zod";
          if (pkg === "react-markdown" || pkg === "remark-gfm") return "vendor-markdown";
          if (pkg === "@hello-pangea/dnd") return "vendor-dnd";
          if (pkg === "sonner" || pkg === "vaul" || pkg === "cmdk" || pkg === "embla-carousel-react")
            return "vendor-ui-extra";
          return "vendor-misc";
        },
      },
    },
  },
}));

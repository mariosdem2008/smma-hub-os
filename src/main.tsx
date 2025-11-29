import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./index.css";

// Auto-detect timezone on app load
const autoDetectTimezone = async () => {
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log("Browser timezone detected:", detectedTimezone);
  
  // Store for later use by components
  sessionStorage.setItem('detectedTimezone', detectedTimezone);
};

autoDetectTimezone();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="smmahub-ui-theme">
    <App />
  </ThemeProvider>
);

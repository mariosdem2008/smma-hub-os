import { useState, useEffect } from "react";
import { getActiveAgencyId } from "@/lib/active-agency";

/**
 * Hook to access the current active agency ID
 * Reads from localStorage and updates on changes
 */
export function useAgency() {
  const [agencyId, setAgencyId] = useState<string | null>(() => getActiveAgencyId());

  useEffect(() => {
    // Get initial value
    const id = getActiveAgencyId();
    setAgencyId(id);

    // Listen for storage changes (in case of cross-tab updates)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "activeAgencyId") {
        setAgencyId(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return { agencyId };
}

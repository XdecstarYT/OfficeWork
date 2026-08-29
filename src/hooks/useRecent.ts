import { useState, useCallback } from "react";
import { loadRecentIds, pushRecentId } from "../lib/storage";

export function useRecent() {
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentIds());

  const markRecent = useCallback((templateId: string) => {
    pushRecentId(templateId);
    setRecentIds(loadRecentIds());
  }, []);

  return { recentIds, markRecent };
}

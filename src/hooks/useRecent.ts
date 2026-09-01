import { useState, useCallback } from "react";
import { loadRecentIds, pushRecentId, clearRecentIds } from "../lib/storage";

export function useRecent() {
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentIds());

  const markRecent = useCallback((templateId: string) => {
    pushRecentId(templateId);
    setRecentIds(loadRecentIds());
  }, []);

  const clearRecent = useCallback(() => {
    clearRecentIds();
    setRecentIds([]);
  }, []);

  return { recentIds, markRecent, clearRecent };
}

import { useCallback, useState } from "react";
import { loadFavorites, saveFavorites } from "../lib/storage";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());

  const toggleFavorite = useCallback((templateId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}

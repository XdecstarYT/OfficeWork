import { useCallback, useState } from "react";
import { loadFavoriteClients, saveFavoriteClients } from "../lib/storage";

export function useFavoriteClients() {
  const [favoriteClients, setFavoriteClients] = useState<Set<string>>(() => loadFavoriteClients());

  const toggleFavoriteClient = useCallback((clientId: string) => {
    setFavoriteClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      saveFavoriteClients(next);
      return next;
    });
  }, []);

  return { favoriteClients, toggleFavoriteClient };
}

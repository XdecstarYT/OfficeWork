import { useCallback, useState } from "react";
import { loadClientRelationships, saveClientRelationships } from "../lib/storage";

export function useClientRelationships() {
  const [relationships, setRelationships] = useState<Record<string, number>>(() =>
    loadClientRelationships(),
  );

  const recordCompletion = useCallback((clientId: string) => {
    setRelationships((prev) => {
      const next = { ...prev, [clientId]: (prev[clientId] ?? 0) + 1 };
      saveClientRelationships(next);
      return next;
    });
  }, []);

  return { relationships, recordCompletion };
}

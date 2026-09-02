import { useCallback, useState } from "react";
import {
  loadClientRelationships,
  saveClientRelationships,
  loadClientEarnings,
  saveClientEarnings,
} from "../lib/storage";

export function useClientRelationships() {
  const [relationships, setRelationships] = useState<Record<string, number>>(() =>
    loadClientRelationships(),
  );
  const [earnings, setEarnings] = useState<Record<string, number>>(() => loadClientEarnings());

  const recordCompletion = useCallback((clientId: string, payout = 0) => {
    setRelationships((prev) => {
      const next = { ...prev, [clientId]: (prev[clientId] ?? 0) + 1 };
      saveClientRelationships(next);
      return next;
    });
    if (payout > 0) {
      setEarnings((prev) => {
        const next = { ...prev, [clientId]: (prev[clientId] ?? 0) + payout };
        saveClientEarnings(next);
        return next;
      });
    }
  }, []);

  return { relationships, earnings, recordCompletion };
}

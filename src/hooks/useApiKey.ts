import { useCallback, useState } from "react";
import { loadApiKey, saveApiKey } from "../lib/apiKey";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>(() => loadApiKey());

  const setApiKey = useCallback((key: string) => {
    saveApiKey(key);
    setApiKeyState(key);
  }, []);

  return { apiKey, hasApiKey: apiKey.trim().length > 0, setApiKey };
}

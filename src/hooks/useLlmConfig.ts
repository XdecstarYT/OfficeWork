import { useCallback, useState } from "react";
import { loadLlmConfig, saveLlmConfig, type LlmConfig } from "../lib/llmConfig";

export function useLlmConfig() {
  const [config, setConfigState] = useState<LlmConfig>(() => loadLlmConfig());

  const setConfig = useCallback((next: LlmConfig) => {
    saveLlmConfig(next);
    setConfigState(next);
  }, []);

  return { config, setConfig };
}

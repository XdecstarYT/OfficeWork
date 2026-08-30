import { useCallback, useState } from "react";
import { loadCustomTemplates, saveCustomTemplates } from "../lib/storage";
import type { DocumentTemplate } from "../types/template";

export function useCustomTemplates() {
  const [customTemplates, setCustomTemplates] = useState<DocumentTemplate[]>(() =>
    loadCustomTemplates(),
  );

  const addCustomTemplate = useCallback((template: DocumentTemplate) => {
    setCustomTemplates((prev) => {
      const next = [template, ...prev.filter((t) => t.id !== template.id)];
      saveCustomTemplates(next);
      return next;
    });
  }, []);

  const removeCustomTemplate = useCallback((id: string) => {
    setCustomTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveCustomTemplates(next);
      return next;
    });
  }, []);

  return { customTemplates, addCustomTemplate, removeCustomTemplate };
}

/** Replaces {{field_id}} tokens in a bodyTemplate with the current field values, for a live preview. */
export function renderBody(bodyTemplate: string, values: Record<string, string>): string {
  return bodyTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : "";
  });
}

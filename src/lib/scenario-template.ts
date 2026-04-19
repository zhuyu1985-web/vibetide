/**
 * Substitute `{{fieldName}}` placeholders in `template` with values from
 * `inputs`. Unknown placeholders are left intact so the rendered text makes
 * it clear which variable wasn't filled in.
 */
export function renderScenarioTemplate(
  template: string,
  inputs: Record<string, string | undefined | null>,
): string {
  return template.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (full, name: string) => {
      const v = inputs[name];
      return v == null || v === "" ? full : String(v);
    },
  );
}

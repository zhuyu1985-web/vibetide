import { nanoid } from "nanoid";

export interface TemplateForSlug {
  legacyScenarioKey: string | null;
  name: string;
}

/**
 * Generate a stable slug for `mission.scenario` field.
 *
 * - Builtin workflow (legacyScenarioKey set): return the key directly (aligns
 *   with SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG const keys).
 * - Custom workflow (legacyScenarioKey null/empty): generate `custom_${nanoid(6)}`
 *   to guarantee a valid slug (not Chinese name) for downstream lookup paths.
 *
 * See spec §4.3 "templateToScenarioSlug rule" and §6 "ensure SCENARIO_CONFIG
 * lookups have fallback".
 */
export function templateToScenarioSlug(template: TemplateForSlug): string {
  if (template.legacyScenarioKey && template.legacyScenarioKey.length > 0) {
    return template.legacyScenarioKey;
  }
  return `custom_${nanoid(6)}`;
}

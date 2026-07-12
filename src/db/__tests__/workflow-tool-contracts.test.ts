import { describe, expect, it } from "vitest";

import { BUILTIN_WORKFLOWS } from "../seed-builtin-workflows";
import { isLLMSkillRegistered } from "@/lib/agent/llm-skill-dispatch";
import { isToolRegistered } from "@/lib/agent/tool-registry";
import {
  hasWorkflowToolParamResolver,
  shouldBlockRegisteredSkillFallback,
} from "@/lib/mission-executor";

function requiresBoundParameters(skillSlug: string): boolean {
  if (!isToolRegistered(skillSlug) && !isLLMSkillRegistered(skillSlug)) {
    return false;
  }
  return shouldBlockRegisteredSkillFallback({
    assignedRole: skillSlug,
    preExecAttempted: false,
    preExecUsedTool: false,
  });
}

describe("builtin workflow tool contracts", () => {
  it("binds parameters for registered steps that cannot use LLM fallback", () => {
    const violations: string[] = [];

    for (const workflow of BUILTIN_WORKFLOWS) {
      for (const step of workflow.steps) {
        const skillSlug = step.config?.skillSlug;
        if (!skillSlug || !requiresBoundParameters(skillSlug)) continue;
        if (Object.keys(step.config?.parameters ?? {}).length > 0) continue;
        if (hasWorkflowToolParamResolver(skillSlug)) continue;
        violations.push(`${workflow.slug}/${step.id}:${skillSlug}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("only references existing upstream step orders", () => {
    const violations: string[] = [];
    const bindingPattern = /\{\{step(\d+)(?:\.|}})/g;

    for (const workflow of BUILTIN_WORKFLOWS) {
      const orders = new Set(workflow.steps.map((step) => step.order));
      for (const step of workflow.steps) {
        const serialized = JSON.stringify(step.config?.parameters ?? {});
        for (const match of serialized.matchAll(bindingPattern)) {
          const referencedOrder = Number(match[1]);
          if (orders.has(referencedOrder) && referencedOrder < step.order) continue;
          violations.push(
            `${workflow.slug}/${step.id}:step${referencedOrder} is not upstream`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("uses structured upstream bindings for known multi-step workflows", () => {
    const breaking = BUILTIN_WORKFLOWS.find((w) => w.slug === "breaking_news");
    const material = BUILTIN_WORKFLOWS.find(
      (w) => w.slug === "hot_material_capture",
    );
    const overseas = BUILTIN_WORKFLOWS.find(
      (w) => w.slug === "hot_topic_single_overseas_repost",
    );

    expect(
      breaking?.steps.find((s) => s.config?.skillSlug === "fact_check")?.config
        ?.parameters,
    ).toMatchObject({ text: "{{step2.text}}" });
    expect(material?.steps[1]?.config?.skillSlug).toBe("batch_deep_read");
    expect(material?.steps[1]?.config?.parameters).toMatchObject({
      items: "{{step1.results}}",
    });
    expect(overseas?.steps[0]?.config?.parameters).toMatchObject({
      targetLanguage: "en",
      variantsPerTopic: "{{variants_per_topic}}",
    });
  });
});

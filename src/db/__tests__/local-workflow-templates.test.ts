import { describe, expect, it } from "vitest";

import { BUILTIN_WORKFLOWS } from "../seed-builtin-workflows";
import {
  renderStepParameters,
  shouldBlockRegisteredSkillFallback,
} from "@/lib/mission-executor";
import { isLLMSkillRegistered } from "@/lib/agent/llm-skill-dispatch";
import { isToolRegistered } from "@/lib/agent/tool-registry";

const TARGET_LOCAL_WORKFLOW_SLUGS = [
  "local_hotspot_chengdu",
  "local_data_news_chengdu",
  "local_policy_interpretation_chengdu",
] as const;

function targetWorkflows() {
  return TARGET_LOCAL_WORKFLOW_SLUGS.map((slug) => {
    const workflow = BUILTIN_WORKFLOWS.find((item) => item.slug === slug);
    expect(workflow, `missing workflow seed: ${slug}`).toBeDefined();
    return workflow!;
  });
}

describe("local workflow seeds", () => {
  it("binds parameters for registered tool steps that cannot fall back to agent output", () => {
    for (const workflow of targetWorkflows()) {
      for (const step of workflow.steps) {
        const skillSlug = step.config?.skillSlug;
        if (!skillSlug) continue;

        const isRegistered =
          isToolRegistered(skillSlug) || isLLMSkillRegistered(skillSlug);
        if (!isRegistered) continue;

        const requiresShortCircuit = shouldBlockRegisteredSkillFallback({
          assignedRole: skillSlug,
          preExecAttempted: false,
          preExecUsedTool: false,
        });
        if (!requiresShortCircuit) continue;

        expect(
          Object.keys(step.config?.parameters ?? {}).length,
          `${workflow.name} / ${step.name} (${skillSlug}) must bind parameters`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("archives the generated article draft for every target local workflow", () => {
    for (const workflow of targetWorkflows()) {
      const contentStep = workflow.steps.find(
        (step) => step.config?.skillSlug === "content_generate",
      );
      expect(contentStep, `${workflow.name} must generate an article`).toBeDefined();

      const archiveStep = workflow.steps.find(
        (step) => step.config?.skillSlug === "archive_to_drafts",
      );
      expect(archiveStep, `${workflow.name} must archive the generated article`).toBeDefined();
      expect(archiveStep!.order).toBeGreaterThan(contentStep!.order);
      expect(archiveStep!.config?.parameters).toMatchObject({
        articles: `{{step${contentStep!.order}.articles}}`,
        initialStatus: "approved",
      });
    }
  });

  it("renders cross-step bindings used by policy interpretation follow-up steps", () => {
    const policy = BUILTIN_WORKFLOWS.find(
      (item) => item.slug === "local_policy_interpretation_chengdu",
    );
    expect(policy).toBeDefined();

    const deepReadStep = policy!.steps.find(
      (step) => step.config?.skillSlug === "web_deep_read",
    );
    const factCheckStep = policy!.steps.find(
      (step) => step.config?.skillSlug === "fact_check",
    );
    expect(deepReadStep).toBeDefined();
    expect(factCheckStep).toBeDefined();

    const previousSteps: Array<{ outputData?: unknown }> = [];
    previousSteps[0] = {
      outputData: {
        results: [
          {
            title: "成都市政策原文",
            url: "https://example.com/policy",
          },
        ],
      },
    };
    previousSteps[3] = {
      outputData: {
        artifacts: [
          {
            content: "政策解读正文，包含政策要点、影响对象和行动建议。",
          },
        ],
      },
    };

    expect(
      renderStepParameters(
        deepReadStep!.config!.parameters ?? {},
        { inputParams: {} },
        previousSteps,
      ),
    ).toMatchObject({
      url: "https://example.com/policy",
    });

    expect(
      renderStepParameters(
        factCheckStep!.config!.parameters ?? {},
        { inputParams: {} },
        previousSteps,
      ),
    ).toMatchObject({
      text: "政策解读正文，包含政策要点、影响对象和行动建议。",
    });
  });

  it("renders local hotspot bindings and keeps the radar report dependent on all data steps", () => {
    const hotspot = BUILTIN_WORKFLOWS.find(
      (item) => item.slug === "local_hotspot_chengdu",
    );
    expect(hotspot).toBeDefined();

    const trendingStep = hotspot!.steps.find(
      (step) => step.config?.skillSlug === "trending_topics",
    );
    const socialStep = hotspot!.steps.find(
      (step) => step.config?.skillSlug === "social_listening",
    );
    const reportStep = hotspot!.steps.find(
      (step) => step.config?.skillSlug === "content_generate",
    );
    expect(trendingStep).toBeDefined();
    expect(socialStep).toBeDefined();
    expect(reportStep?.dependsOn).toEqual([
      "step-1",
      "step-2",
      "step-3",
      "step-4",
    ]);

    const inputParams = {
      city: "成都",
      platforms: ["weibo", "douyin"],
      domain: "民生",
      top_n: 5,
    };

    expect(
      renderStepParameters(
        trendingStep!.config!.parameters ?? {},
        { inputParams },
        [],
      ),
    ).toMatchObject({
      mode: "platforms",
      platforms: ["weibo", "douyin"],
      limit: "5",
    });

    expect(
      renderStepParameters(socialStep!.config!.parameters ?? {}, { inputParams }, []),
    ).toMatchObject({
      query: "成都 民生 本地热点",
      platforms: ["weibo", "douyin"],
      limit: "5",
    });
  });

  it("renders local data-news bindings and exposes all data inputs to the writing step", () => {
    const dataNews = BUILTIN_WORKFLOWS.find(
      (item) => item.slug === "local_data_news_chengdu",
    );
    expect(dataNews).toBeDefined();

    const searchStep = dataNews!.steps.find(
      (step) => step.config?.skillSlug === "web_search",
    );
    const dataStep = dataNews!.steps.find(
      (step) => step.config?.skillSlug === "data_report",
    );
    const writingStep = dataNews!.steps.find(
      (step) => step.name === "数据新闻撰写",
    );
    expect(searchStep).toBeDefined();
    expect(dataStep).toBeDefined();
    expect(writingStep?.dependsOn).toEqual(["step-1", "step-2", "step-3"]);

    const inputParams = {
      city: "成都",
      data_types: ["weather", "housing", "transport"],
      period: { from: "2026-05-23", to: "2026-05-30" },
      compare_to: "wow",
    };

    expect(
      renderStepParameters(searchStep!.config!.parameters ?? {}, { inputParams }, []),
    ).toMatchObject({
      timeRange: "30d",
      maxResults: 8,
      topic: "news",
    });

    expect(
      renderStepParameters(dataStep!.config!.parameters ?? {}, { inputParams }, []),
    ).toMatchObject({
      reportType: "weekly",
      metrics: ["weather", "housing", "transport"],
    });
  });
});

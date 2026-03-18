import type { EmployeeId } from "@/lib/constants";
import type { StepOutput, StepArtifact, ArtifactType } from "./types";

// Map step keys to their expected primary artifact type
const STEP_ARTIFACT_TYPE: Record<string, ArtifactType> = {
  monitor: "hot_topic_list",
  plan: "topic_angles",
  material: "material_brief",
  create: "article_draft",
  produce: "video_script",
  review: "review_report",
  publish: "publish_plan",
  analyze: "analytics_report",
};

/**
 * Extract quality self-evaluation score from agent output.
 * Looks for pattern: 【质量自评：XX/100】
 */
export function extractQualityScore(rawText: string): number | undefined {
  const match = rawText.match(/【质量自评[：:]\s*(\d{1,3})\s*[/／]\s*100\s*】/);
  if (match) {
    const score = parseInt(match[1], 10);
    if (score >= 0 && score <= 100) return score;
  }
  return undefined;
}

/**
 * Parse raw LLM text output into a structured StepOutput.
 * This is a best-effort extraction — the LLM output may not follow
 * the expected format perfectly, so we gracefully degrade.
 */
export function parseStepOutput(
  rawText: string,
  stepKey: string,
  employeeSlug: EmployeeId
): StepOutput {
  // Extract summary: first paragraph or first 200 chars
  const lines = rawText.split("\n").filter((l) => l.trim());
  const summary =
    lines[0]?.replace(/^#+\s*/, "").trim() ?? "步骤已完成";

  // Create a single artifact from the full output
  const artifactType = STEP_ARTIFACT_TYPE[stepKey] ?? "generic";
  const artifact: StepArtifact = {
    id: `${stepKey}-${Date.now()}`,
    type: artifactType,
    title: `${stepKey} 产出`,
    content: rawText,
  };

  // Rough word count for Chinese text (characters)
  const wordCount = rawText.replace(/\s/g, "").length;

  // Extract quality self-evaluation score
  const qualityScore = extractQualityScore(rawText);

  return {
    stepKey,
    employeeSlug,
    summary,
    artifacts: [artifact],
    metrics: { wordCount, qualityScore },
    status: "success",
  };
}

/**
 * Serialize a StepOutput to JSON for DB storage.
 */
export function serializeStepOutput(output: StepOutput): string {
  return JSON.stringify(output);
}

/**
 * Deserialize a StepOutput from DB JSON.
 */
export function deserializeStepOutput(json: unknown): StepOutput | null {
  if (!json || typeof json !== "object") return null;
  return json as StepOutput;
}

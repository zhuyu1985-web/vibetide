import { describe, it, expect } from "vitest";
import {
  cmsPublicationStateEnum,
  reviewTierEnum,
  artifactTypeEnum,
} from "../enums";

describe("CMS enums", () => {
  it("cmsPublicationStateEnum has exactly 6 values in the order from spec §11.3", () => {
    // Drizzle pgEnum exposes `.enumValues` at runtime.
    // 顺序严格对齐 spec §11.3 —— 顺序不同会导致 Postgres enum 声明顺序不一致，
    // 后续修正需要 ALTER TYPE 重建迁移。
    expect(cmsPublicationStateEnum.enumValues).toEqual([
      "submitting",
      "submitted",
      "synced",
      "rejected_by_cms",
      "failed",
      "retrying",
    ]);
  });

  it("reviewTierEnum has exactly 2 values", () => {
    expect(reviewTierEnum.enumValues).toEqual(["strict", "relaxed"]);
  });

  it("artifactTypeEnum includes 'cms_publication' (spec §11.3 extension)", () => {
    // Task 33 的 workflow_artifacts 写入依赖 cms_publication 值存在
    expect(artifactTypeEnum.enumValues).toContain("cms_publication");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cms", () => ({
  publishArticleToCms: vi.fn().mockResolvedValue({
    success: true, publicationId: "pub-1", cmsState: "submitted",
    timings: { totalMs: 1, mappingMs: 1, httpMs: 1 },
  }),
}));
vi.mock("@/lib/dal/cms-publications", () => ({
  getPublicationById: vi.fn(),
  incrementAttempt: vi.fn(),
}));

import { publishArticleToCms } from "@/lib/cms";
import { getPublicationById } from "@/lib/dal/cms-publications";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cmsPublishRetry — target 还原", () => {
  it("从 publication.requestPayload._target 还原 target 传给 publishArticleToCms", async () => {
    vi.mocked(getPublicationById).mockResolvedValue({
      id: "pub-1",
      articleId: "art-1",
      operatorId: "op-1",
      cmsState: "retrying",
      attempts: 1,
      requestPayload: { title: "t", _target: { catalogId: 10462 } },
    } as never);

    const { republishWithRestoredTarget } = await import(
      "@/inngest/functions/cms-publish-retry"
    );
    await republishWithRestoredTarget("pub-1");

    expect(vi.mocked(publishArticleToCms)).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { catalogId: 10462 },
      }),
    );
  });

  it("publication 无 _target → target 为 undefined", async () => {
    vi.mocked(getPublicationById).mockResolvedValue({
      id: "pub-1",
      articleId: "art-1",
      operatorId: "op-1",
      cmsState: "retrying",
      attempts: 1,
      requestPayload: { title: "t" },
    } as never);

    const { republishWithRestoredTarget } = await import(
      "@/inngest/functions/cms-publish-retry"
    );
    await republishWithRestoredTarget("pub-1");

    expect(vi.mocked(publishArticleToCms)).toHaveBeenCalledWith(
      expect.objectContaining({ target: undefined }),
    );
  });
});

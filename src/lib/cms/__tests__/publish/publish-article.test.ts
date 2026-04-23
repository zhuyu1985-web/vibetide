import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
  cmsErrorResponse,
} from "../test-helpers";

// ─── Mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/dal/articles", () => ({
  getArticleById: vi.fn(),
}));
vi.mock("@/lib/dal/cms-publications", () => ({
  createPublication: vi.fn().mockResolvedValue("pub-uuid-1"),
  updateToSubmitted: vi.fn(),
  markAsSynced: vi.fn(),
  markAsRejectedByCms: vi.fn(),
  markAsFailed: vi.fn(),
  incrementAttempt: vi.fn(),
  findLatestSuccessByArticle: vi.fn().mockResolvedValue(null),
  getPublicationById: vi.fn(),
}));
vi.mock("@/lib/cms/article-mapper", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cms/article-mapper")>(
    "@/lib/cms/article-mapper",
  );
  return {
    ...actual,
    loadMapperContext: vi.fn(),
  };
});
vi.mock("@/lib/dal/organizations", () => ({
  getOrganizationById: vi.fn(),
}));
vi.mock("@/lib/dal/workflow-artifacts", () => ({
  insertWorkflowArtifact: vi.fn(),
}));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));

import { publishArticleToCms } from "../../publish/publish-article";
import { getArticleById } from "@/lib/dal/articles";
import {
  createPublication,
  updateToSubmitted,
  markAsFailed,
  findLatestSuccessByArticle,
} from "@/lib/dal/cms-publications";
import { loadMapperContext } from "@/lib/cms/article-mapper";
import { getOrganizationById } from "@/lib/dal/organizations";

const baseMapperCtx = {
  siteId: 81,
  appId: 10,
  catalogId: 8634,
  tenantId: "t",
  loginId: "id",
  loginTid: "tid",
  username: "admin",
  source: "深圳广电",
  author: "智媒编辑部",
  listStyleDefault: {
    imageUrlList: [],
    listStyleName: "默认",
    listStyleType: "0",
  },
  coverImageDefault: "https://cdn/d.jpg",
};

const baseArticle = {
  id: "art-1",
  organizationId: "org-1",
  title: "深圳 AI 产业 200 亿新政",
  body: "<p>正文内容</p>",
  authorName: null,
  summary: "摘要",
  shortTitle: null,
  tags: ["AI"],
  coverImageUrl: null,
  publishStatus: "approved",
  publishedAt: null,
  externalUrl: null,
  galleryImages: null,
  videoId: null,
  audioId: null,
  mediaType: "article",
  missionId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "true";
  process.env.CMS_HOST = "https://cms.example.com";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "tenant";
  process.env.CMS_USERNAME = "admin";
  (loadMapperContext as ReturnType<typeof vi.fn>).mockResolvedValue(
    baseMapperCtx,
  );
  (getArticleById as ReturnType<typeof vi.fn>).mockResolvedValue(baseArticle);
  (getOrganizationById as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "org-1",
    brandName: "深圳广电",
  });
  (createPublication as ReturnType<typeof vi.fn>).mockResolvedValue(
    "pub-uuid-1",
  );
  (findLatestSuccessByArticle as ReturnType<typeof vi.fn>).mockResolvedValue(
    null,
  );
});
afterEach(() => restoreCmsFetch());

describe("publishArticleToCms", () => {
  it("happy path: creates pub record + calls CMS + updates to submitted", async () => {
    mockCmsFetch([
      cmsSuccessResponse({
        article: { id: 925194, status: 0, title: "x" },
        url: "1376/x/925194.shtml",
        preViewPath: "https://cms/preview",
        method: "ADD",
      }),
    ]);

    const result = await publishArticleToCms({
      articleId: "art-1",
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });

    expect(result.success).toBe(true);
    expect(result.cmsArticleId).toBe("925194");
    expect(result.cmsState).toBe("submitted");
    expect(createPublication).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        articleId: "art-1",
        cmsType: 1,
      }),
    );
    expect(updateToSubmitted).toHaveBeenCalledWith(
      "pub-uuid-1",
      expect.objectContaining({ cmsArticleId: "925194" }),
    );
  });

  it("returns existing record when article already successfully published", async () => {
    (findLatestSuccessByArticle as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        id: "pub-old-1",
        cmsArticleId: "999",
        cmsState: "synced",
        publishedUrl: "https://x",
        previewUrl: "https://p",
      },
    );

    const result = await publishArticleToCms({
      articleId: "art-1",
      operatorId: "xiaofa",
      triggerSource: "workflow",
      allowUpdate: false,
    });

    expect(result.success).toBe(true);
    expect(result.publicationId).toBe("pub-old-1");
    expect(createPublication).not.toHaveBeenCalled();
  });

  it("reuses articleId on re-publish when allowUpdate=true (modifies existing CMS article)", async () => {
    (findLatestSuccessByArticle as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        id: "pub-old",
        cmsArticleId: "925194",
        cmsState: "synced",
      },
    );

    let capturedBody: Record<string, unknown> | undefined;
    const spy = vi
      .spyOn(globalThis as { fetch: typeof fetch }, "fetch")
      .mockImplementation((async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse((init?.body as string) ?? "{}") as Record<
          string,
          unknown
        >;
        return cmsSuccessResponse({
          article: { id: 925194 },
          url: "x",
          preViewPath: "y",
          method: "MODIFY",
        });
      }) as typeof fetch);

    try {
      await publishArticleToCms({
        articleId: "art-1",
        operatorId: "xiaofa",
        triggerSource: "manual",
        allowUpdate: true,
      });

      expect(capturedBody?.articleId).toBe(925194); // 触发 CMS MODIFY 路径
    } finally {
      spy.mockRestore();
    }
  });

  it("fails fast when feature flag disabled", async () => {
    process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "false";
    await expect(
      publishArticleToCms({
        articleId: "art-1",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow(/disabled|feature/i);
  });

  it("marks as failed with retriable=true on 500 error", async () => {
    mockCmsFetch([cmsErrorResponse(500, "内部错误")]);
    // 关闭 retry 以简化测试
    process.env.CMS_MAX_RETRIES = "0";

    await expect(
      publishArticleToCms({
        articleId: "art-1",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow();
    expect(markAsFailed).toHaveBeenCalledWith(
      "pub-uuid-1",
      expect.objectContaining({ retriable: true }),
    );
    process.env.CMS_MAX_RETRIES = "3";
  });

  it("marks as failed retriable=false on auth error (no retry)", async () => {
    mockCmsFetch([cmsErrorResponse(401, "未登录")]);
    await expect(
      publishArticleToCms({
        articleId: "art-1",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow();
    expect(markAsFailed).toHaveBeenCalledWith(
      "pub-uuid-1",
      expect.objectContaining({ retriable: false }),
    );
  });

  it("throws when article not found", async () => {
    (getArticleById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      publishArticleToCms({
        articleId: "missing",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow(/article not found/i);
  });

  it("throws when article status != approved (and later states)", async () => {
    (getArticleById as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...baseArticle,
      publishStatus: "draft",
    });
    await expect(
      publishArticleToCms({
        articleId: "art-1",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow(/not approved|status/i);
  });

  it("throws CmsConfigError when app_channel not mapped", async () => {
    // loadMapperContext is synchronous in real code (throws directly),
    // so the mock must throw synchronously too; mockRejectedValue would
    // return a Promise that the call site doesn't await, starving the error.
    (loadMapperContext as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("app_channel_not_mapped: app_news");
    });
    await expect(
      publishArticleToCms({
        articleId: "art-1",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow(/app_channel_not_mapped/);
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsPublications, organizations, articles } from "@/db/schema";
import {
  createPublication,
  findLatestSuccessByArticle,
  updateToSubmitted,
  markAsFailed,
  incrementAttempt,
  listByState,
} from "../cms-publications";
import { eq } from "drizzle-orm";

describe("DAL cms-publications", () => {
  const orgId = randomUUID();
  const articleId = randomUUID();

  beforeAll(async () => {
    // cms_publications 有 2 个 FK：organization_id + article_id。
    // 先 seed organizations，再 seed articles。
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values({ id: orgId, name: "test-org-cms-pub", slug: `test-cms-pub-${stamp}` })
      .onConflictDoNothing();
    await db
      .insert(articles)
      .values({
        id: articleId,
        organizationId: orgId,
        title: "Test Article for cms_publications",
        body: "test body",
        status: "draft",
        mediaType: "article",
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(cmsPublications).where(eq(cmsPublications.organizationId, orgId));
  });

  afterAll(async () => {
    await db.delete(cmsPublications).where(eq(cmsPublications.organizationId, orgId));
    await db.delete(articles).where(eq(articles.id, articleId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("createPublication inserts with state=submitting", async () => {
    const id = await createPublication({
      organizationId: orgId,
      articleId,
      cmsType: 1,
      requestHash: "h1",
      requestPayload: { title: "Test" },
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    const row = await db.query.cmsPublications.findFirst({
      where: eq(cmsPublications.id, id),
    });
    expect(row?.cmsState).toBe("submitting");
    expect(row?.attempts).toBe(1);
  });

  it("updateToSubmitted records cmsArticleId and previewUrl", async () => {
    const id = await createPublication({
      organizationId: orgId,
      articleId,
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    await updateToSubmitted(id, {
      cmsArticleId: "925194",
      cmsCatalogId: "8634",
      cmsSiteId: 81,
      publishedUrl: "https://web.cms.com/x.shtml",
      previewUrl: "https://api.cms.com/preview?x=1",
      responsePayload: { article: { id: 925194 } },
    });
    const row = await db.query.cmsPublications.findFirst({
      where: eq(cmsPublications.id, id),
    });
    expect(row?.cmsState).toBe("submitted");
    expect(row?.cmsArticleId).toBe("925194");
    expect(row?.publishedUrl).toContain(".shtml");
  });

  it("markAsFailed sets error info without mutating cmsArticleId", async () => {
    const id = await createPublication({
      organizationId: orgId,
      articleId,
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    await markAsFailed(id, {
      errorCode: "cms_auth_error",
      errorMessage: "login_cmc_id 失效",
      retriable: false,
    });
    const row = await db.query.cmsPublications.findFirst({
      where: eq(cmsPublications.id, id),
    });
    expect(row?.cmsState).toBe("failed");
    expect(row?.errorCode).toBe("cms_auth_error");
  });

  it("incrementAttempt bumps attempts counter", async () => {
    const id = await createPublication({
      organizationId: orgId,
      articleId,
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    await incrementAttempt(id);
    await incrementAttempt(id);
    const row = await db.query.cmsPublications.findFirst({
      where: eq(cmsPublications.id, id),
    });
    expect(row?.attempts).toBe(3);
  });

  it("findLatestSuccessByArticle returns the most recent synced record", async () => {
    const id1 = await createPublication({
      organizationId: orgId,
      articleId,
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    await updateToSubmitted(id1, { cmsArticleId: "1001" });

    const found = await findLatestSuccessByArticle(articleId);
    expect(found?.cmsArticleId).toBe("1001");
  });

  it("listByState returns rows filtered by org + state", async () => {
    await createPublication({
      organizationId: orgId,
      articleId,
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    const rows = await listByState(orgId, "submitting");
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.cmsState === "submitting")).toBe(true);
  });
});

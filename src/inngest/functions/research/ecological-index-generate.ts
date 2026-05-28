// src/inngest/functions/research/ecological-index-generate.ts
//
// P3.8 — 生态文明传播指数报告 7 步 Inngest 流水线
//
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.4
//
// Step 1 load-resources       : 读 scope (含 units + resolvedOutletIds) + activityDataset
// Step 2 compute-indicators   : SQL 拉 items + topics + districts, 调 computeIndicators
// Step 3 build-xlsx-19sheet   : buildIndexReportXlsx + upload storage → excelFileUrl
// Step 4+5 build-charts-and-docx (合并以避免大 Buffer 跨 step 序列化)
//                             : renderAllCharts + buildRankingReportDocx + upload → wordFileUrl
// Step 6 (按 tier 拆 4 子 step, 仅 includeContentSource=true 时跑):
//   Step 6a-6d content-{tier} : 拉 tier items + buildContentXlsxForTier + upload → contentSourceFileUrls[tier]
// Step 7 finalize             : status='ready' + aggregatesJson + 发 completed event
//
// 错误处理: 任意 step throw → 整个 function 标 failed + 发 failed event + 抛错让 Inngest retry 3 次

import { and, eq, gte, inArray, lt } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  collectedItems,
  collectedItemContents,
} from "@/db/schema/collection";
import {
  researchCollectedItemDistricts,
  researchCollectedItemTopics,
} from "@/db/schema/research/annotations";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { researchTopics } from "@/db/schema/research/research-topics";

import {
  getEcologicalIndexReportById,
  updateEcologicalIndexReportStatus,
} from "@/lib/dal/research/ecological-index-reports";
import { getMediaScopeById } from "@/lib/dal/research/media-scopes";
import { getActivityDatasetById } from "@/lib/dal/research/activity-datasets";

import {
  computeIndicators,
  MEDIA_TIERS,
  type ComputeItem,
  type MediaTier,
} from "@/lib/research/ecological-index/compute";
import { renderAllCharts } from "@/lib/research/ecological-index/chart-generator";
import { buildRankingReportDocx } from "@/lib/research/ecological-index/docx-builder";
import { buildIndexReportXlsx } from "@/lib/research/ecological-index/xlsx-builder";
import {
  buildContentXlsxForTier,
  storageNameForTier,
} from "@/lib/research/ecological-index/content-exporter";
import type { ExportItemRow } from "@/lib/collection/bulk-export/opinion-export";
import type { ParsedScopeUnit } from "@/lib/research/ecological-index/types";

import {
  uploadFile,
  getSignedUrl,
  buildObjectPath,
} from "@/lib/research/report-storage";

// ── 内容源 xlsx 签名 URL 有效期: 7 天 (默认 24h 不够人工核对) ──
const CONTENT_XLSX_TTL_SEC = 60 * 60 * 24 * 7;

export const ecologicalIndexGenerate = inngest.createFunction(
  {
    id: "research-ecological-index-generate",
    concurrency: { limit: 2, key: "event.data.organizationId" },
    retries: 3,
  },
  { event: "research/ecological-index.generate" },
  async ({ event, step, logger }) => {
    const { reportId, organizationId } = event.data;

    // ─── Mark started ──────────────────────────────────────────────
    await step.run("mark-started", async () => {
      await updateEcologicalIndexReportStatus(reportId, {
        status: "generating",
        currentStep: "load-resources",
        startedAt: new Date(),
        errorMessage: null,
      });
    });

    try {
      // ─── Step 1: load-resources ───────────────────────────────────
      const ctx = await step.run("step-1-load-resources", async () => {
        const report = await getEcologicalIndexReportById(
          organizationId,
          reportId,
        );
        if (!report) throw new Error(`report ${reportId} not found`);

        const snap = report.searchSnapshot;
        const scope = await getMediaScopeById(organizationId, snap.scopeId);
        if (!scope) throw new Error(`Scope ${snap.scopeId} 已被删除`);

        const dataset = await getActivityDatasetById(
          organizationId,
          snap.activityDatasetId,
        );
        if (!dataset) {
          throw new Error(`ActivityDataset ${snap.activityDatasetId} 已被删除`);
        }

        // outlet 白名单按 tier 分组 (district_rmt + district_gov 合并到 district)
        const outletByTier: Record<MediaTier, string[]> = {
          central: [],
          industry: [],
          municipal: [],
          district: [],
        };
        for (const u of scope.units) {
          const target: MediaTier | null =
            u.tier === "central"
              ? "central"
              : u.tier === "industry"
                ? "industry"
                : u.tier === "municipal"
                  ? "municipal"
                  : u.tier === "district_rmt" || u.tier === "district_gov"
                    ? "district"
                    : null;
          if (!target) continue;
          for (const oid of u.resolvedOutletIds ?? []) {
            outletByTier[target].push(oid);
          }
        }

        return {
          title: report.title,
          year: snap.year,
          windowStart: snap.windowStart,
          windowEnd: snap.windowEnd,
          includeContentSource: snap.includeContentSource,
          // 把 units (DB row) 映射成 ParsedScopeUnit 形状供 xlsx-builder 用
          units: scope.units.map<ParsedScopeUnit>((u) => ({
            xlsxRow: u.xlsxRow,
            name: u.name,
            tier: u.tier,
            districtOrig: u.districtOrig,
            districtNormalized: u.districtNormalized,
            websites: u.websites,
            wechatNames: u.wechatNames,
            wechatGhid: u.wechatGhid,
            weiboUid: u.weiboUid,
            weiboHandle: u.weiboHandle,
            douyinUrl: u.douyinUrl,
            kuaishouUrl: u.kuaishouUrl,
            notes: u.notes,
          })),
          activities: dataset.data,
          outletByTier,
        };
      });

      // ─── Step 2: compute-indicators ────────────────────────────────
      const computeResult = await step.run(
        "step-2-compute-indicators",
        async () => {
          await updateEcologicalIndexReportStatus(reportId, {
            currentStep: "compute-indicators",
          });

          // 1. 拉 39 区县(按 sortOrder 决定输出顺序)
          const districts = await db
            .select({
              id: cqDistricts.id,
              name: cqDistricts.name,
            })
            .from(cqDistricts)
            .orderBy(cqDistricts.sortOrder, cqDistricts.name);
          const districtNames = districts.map((d) => d.name);

          // 2. 拉 16 主题(按 sortOrder 保证 topicIdx 稳定)
          const topics = await db
            .select({
              id: researchTopics.id,
              name: researchTopics.name,
            })
            .from(researchTopics)
            .where(eq(researchTopics.organizationId, organizationId))
            .orderBy(researchTopics.sortOrder, researchTopics.name);
          const topicIdToIdx = new Map(topics.map((t, i) => [t.id, i]));

          // 3. outlet → tier 反向查
          const outletToTier = new Map<string, MediaTier>();
          for (const tier of MEDIA_TIERS) {
            for (const oid of ctx.outletByTier[tier]) {
              outletToTier.set(oid, tier);
            }
          }
          const allOutlets = Array.from(outletToTier.keys());

          // 4. 拉 items + topic + district join
          const items: ComputeItem[] = [];
          if (allOutlets.length > 0) {
            const windowStartDate = new Date(ctx.windowStart);
            const windowEndDate = new Date(ctx.windowEnd);

            // 先 join districts (内连接, 不命中 district 的 item 不参与计算)
            const districtRows = await db
              .select({
                itemId: collectedItems.id,
                outletId: collectedItems.outletId,
                publishedAt: collectedItems.publishedAt,
                districtName: cqDistricts.name,
              })
              .from(collectedItems)
              .innerJoin(
                researchCollectedItemDistricts,
                eq(
                  researchCollectedItemDistricts.collectedItemId,
                  collectedItems.id,
                ),
              )
              .innerJoin(
                cqDistricts,
                eq(
                  cqDistricts.id,
                  researchCollectedItemDistricts.districtId,
                ),
              )
              .where(
                and(
                  eq(collectedItems.organizationId, organizationId),
                  inArray(collectedItems.outletId, allOutlets),
                  gte(collectedItems.publishedAt, windowStartDate),
                  lt(collectedItems.publishedAt, windowEndDate),
                ),
              );

            // 把 item topic annotation 单独拉一份(避免 inner join 把无 topic 的 item 漏掉)
            // 一条 item 可能对应多个 topic — 全部展开成 (itemId, topicId) tuples
            const districtItemIds = districtRows.map((r) => r.itemId);
            const topicRows: Array<{ itemId: string; topicId: string }> =
              districtItemIds.length > 0
                ? await db
                    .select({
                      itemId: researchCollectedItemTopics.collectedItemId,
                      topicId: researchCollectedItemTopics.topicId,
                    })
                    .from(researchCollectedItemTopics)
                    .where(
                      inArray(
                        researchCollectedItemTopics.collectedItemId,
                        districtItemIds,
                      ),
                    )
                : [];
            // Map<itemId, topicId[]>
            const topicsByItem = new Map<string, string[]>();
            for (const r of topicRows) {
              const arr = topicsByItem.get(r.itemId) ?? [];
              arr.push(r.topicId);
              topicsByItem.set(r.itemId, arr);
            }

            for (const r of districtRows) {
              if (!r.outletId || !r.publishedAt) continue;
              const tier = outletToTier.get(r.outletId);
              if (!tier) continue;
              const publishedDate = r.publishedAt.toISOString().slice(0, 10);
              const topicIds = topicsByItem.get(r.itemId);
              if (topicIds && topicIds.length > 0) {
                // 一条 item 命中多 topic 时, 每个 topic 都贡献 1 次主题计数
                for (const tid of topicIds) {
                  const topicIdx = topicIdToIdx.get(tid) ?? -1;
                  items.push({
                    itemId: r.itemId,
                    districtName: r.districtName,
                    tier,
                    topicIdx,
                    publishedDate,
                  });
                }
              } else {
                // 没标主题的 item 也算进 count/freq, 但不计入 richness
                items.push({
                  itemId: r.itemId,
                  districtName: r.districtName,
                  tier,
                  topicIdx: -1,
                  publishedDate,
                });
              }
            }
          }

          return computeIndicators(districtNames, items, ctx.activities);
        },
      );

      // ─── Step 3: build-xlsx-19sheet ───────────────────────────────
      await step.run("step-3-build-xlsx", async () => {
        await updateEcologicalIndexReportStatus(reportId, {
          currentStep: "build-xlsx-19sheet",
        });
        const buf = buildIndexReportXlsx({
          result: computeResult,
          units: ctx.units,
          activities: ctx.activities,
        });
        const objectPath = buildObjectPath(
          organizationId,
          reportId,
          "19sheet.xlsx",
        );
        await uploadFile(
          objectPath,
          buf,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        const signed = await getSignedUrl(objectPath, CONTENT_XLSX_TTL_SEC);
        await updateEcologicalIndexReportStatus(reportId, {
          excelFileUrl: signed.url,
        });
      });

      // ─── Step 4+5: build-charts-and-docx (合并避免大 Buffer 跨 step 序列化) ──
      await step.run("step-4-5-build-charts-and-docx", async () => {
        await updateEcologicalIndexReportStatus(reportId, {
          currentStep: "build-charts-and-docx",
        });
        const charts = await renderAllCharts(computeResult);
        const docxBuf = await buildRankingReportDocx({
          title: ctx.title,
          year: ctx.year,
          result: computeResult,
          charts,
        });
        const objectPath = buildObjectPath(
          organizationId,
          reportId,
          "ranking.docx",
        );
        await uploadFile(
          objectPath,
          docxBuf,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
        const signed = await getSignedUrl(objectPath, CONTENT_XLSX_TTL_SEC);
        await updateEcologicalIndexReportStatus(reportId, {
          wordFileUrl: signed.url,
        });
      });

      // ─── Step 6: build-content-{tier} (仅 includeContentSource=true) ──
      const contentUrls: {
        central: string | null;
        industry: string | null;
        municipal: string | null;
        district: string | null;
      } = {
        central: null,
        industry: null,
        municipal: null,
        district: null,
      };

      if (ctx.includeContentSource) {
        for (const tier of MEDIA_TIERS) {
          const url = await step.run(
            `step-6-build-content-${tier}`,
            async () => {
              await updateEcologicalIndexReportStatus(reportId, {
                currentStep: `build-content-${tier}`,
              });

              const outletIds = ctx.outletByTier[tier];
              if (outletIds.length === 0) {
                logger.warn(
                  `[eco-index] tier ${tier} 无 outlet 白名单, 跳过 content xlsx`,
                );
                return null;
              }

              const windowStartDate = new Date(ctx.windowStart);
              const windowEndDate = new Date(ctx.windowEnd);

              // 拉完整 ExportItemRow (含 content / ocrText / asrText)
              const rows = await db
                .select({
                  id: collectedItems.id,
                  organizationId: collectedItems.organizationId,
                  contentFingerprint: collectedItems.contentFingerprint,
                  canonicalUrl: collectedItems.canonicalUrl,
                  canonicalUrlHash: collectedItems.canonicalUrlHash,
                  title: collectedItems.title,
                  summary: collectedItems.summary,
                  publishedAt: collectedItems.publishedAt,
                  firstSeenSourceId: collectedItems.firstSeenSourceId,
                  firstSeenChannel: collectedItems.firstSeenChannel,
                  firstSeenAt: collectedItems.firstSeenAt,
                  sourceChannels: collectedItems.sourceChannels,
                  category: collectedItems.category,
                  tags: collectedItems.tags,
                  language: collectedItems.language,
                  derivedModules: collectedItems.derivedModules,
                  rawMetadata: collectedItems.rawMetadata,
                  enrichmentStatus: collectedItems.enrichmentStatus,
                  createdAt: collectedItems.createdAt,
                  updatedAt: collectedItems.updatedAt,
                  contentType: collectedItems.contentType,
                  attachments: collectedItems.attachments,
                  outletId: collectedItems.outletId,
                  outletTier: collectedItems.outletTier,
                  outletRegion: collectedItems.outletRegion,
                  externalId: collectedItems.externalId,
                  platform: collectedItems.platform,
                  author: collectedItems.author,
                  accountId: collectedItems.accountId,
                  accountHandle: collectedItems.accountHandle,
                  authorFollowerCount: collectedItems.authorFollowerCount,
                  sentiment: collectedItems.sentiment,
                  infoType: collectedItems.infoType,
                  likeCount: collectedItems.likeCount,
                  commentCount: collectedItems.commentCount,
                  shareCount: collectedItems.shareCount,
                  viewCount: collectedItems.viewCount,
                  favoriteCount: collectedItems.favoriteCount,
                  replyCount: collectedItems.replyCount,
                  ipRegion: collectedItems.ipRegion,
                  postRegion: collectedItems.postRegion,
                  mentionedRegions: collectedItems.mentionedRegions,
                  matchedKeywords: collectedItems.matchedKeywords,
                  matchedRegions: collectedItems.matchedRegions,
                  industries: collectedItems.industries,
                  coverImageUrl: collectedItems.coverImageUrl,
                  durationSeconds: collectedItems.durationSeconds,
                  compositeScore: collectedItems.compositeScore,
                  content: collectedItemContents.content,
                  ocrText: collectedItemContents.ocrText,
                  asrText: collectedItemContents.asrText,
                })
                .from(collectedItems)
                .leftJoin(
                  collectedItemContents,
                  eq(collectedItemContents.itemId, collectedItems.id),
                )
                .where(
                  and(
                    eq(collectedItems.organizationId, organizationId),
                    inArray(collectedItems.outletId, outletIds),
                    gte(collectedItems.publishedAt, windowStartDate),
                    lt(collectedItems.publishedAt, windowEndDate),
                  ),
                );

              // drizzle select 返 (Date | null) for publishedAt, ExportItemRow 要求一致
              // type cast: 列 schema 与 InferSelectModel<typeof collectedItems> 对齐, 只需补 content/ocr/asr
              const items = rows as ExportItemRow[];

              const buf = buildContentXlsxForTier(items, tier);
              const objectPath = buildObjectPath(
                organizationId,
                reportId,
                `${storageNameForTier(tier)}.xlsx`,
              );
              await uploadFile(
                objectPath,
                buf,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              );
              const signed = await getSignedUrl(
                objectPath,
                CONTENT_XLSX_TTL_SEC,
              );
              return signed.url;
            },
          );
          contentUrls[tier] = url;
        }

        await updateEcologicalIndexReportStatus(reportId, {
          contentSourceFileUrls: contentUrls,
        });
      }

      // ─── Step 7: finalize ────────────────────────────────────────
      await step.run("step-7-finalize", async () => {
        await updateEcologicalIndexReportStatus(reportId, {
          status: "ready",
          currentStep: null,
          completedAt: new Date(),
          aggregatesJson: {
            kind: "ecological_index",
            ranked: computeResult.ranked,
            rawMedia: computeResult.rawMedia,
            rawPublic: computeResult.rawPublic,
            scaledMedia: computeResult.scaledMedia,
            scaledPublic: computeResult.scaledPublic,
            stats: computeResult.stats,
            generatedAt: new Date().toISOString(),
          },
        });
        await inngest.send({
          name: "research/ecological-index.completed",
          data: { reportId, organizationId },
        });
      });

      return { reportId, status: "ready" as const };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`[eco-index] generate failed: ${errorMessage}`);
      // 直接走 DAL 写 failed status (不走 step.run, 避免错误处理也被算成 step retry)
      try {
        await updateEcologicalIndexReportStatus(reportId, {
          status: "failed",
          errorMessage,
          completedAt: new Date(),
          currentStep: null,
        });
        await inngest.send({
          name: "research/ecological-index.failed",
          data: { reportId, organizationId, error: errorMessage },
        });
      } catch (innerErr) {
        logger.error(
          `[eco-index] failed to record failure status: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`,
        );
      }
      throw err; // 让 Inngest 知道这次失败, 触发 retry
    }
  },
);

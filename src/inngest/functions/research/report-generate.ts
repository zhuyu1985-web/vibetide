// src/inngest/functions/research/report-generate.ts
//
// A5 Phase 4 — 报告生成 Inngest 7-step pipeline 骨架（Step 1-4 串通 + Step 7 finalize）
//
// Phase 4 范围：Step 1 数据聚合 → Step 2 模板插值 → Step 3 AI 段落 → Step 4 HTML → Step 7 finalize
// Step 5（Word 生成）+ Step 6（Excel 生成）留 Phase 6 / Phase 7 接入。
//
// Spec: docs/superpowers/specs/2026-05-07-a5-report-export-design.md §4.1
// Plan: docs/superpowers/plans/2026-05-07-a5-report-export-plan.md Phase 4

import { and, eq, inArray } from "drizzle-orm";
import { generateText, Output } from "ai";

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { collectedItems } from "@/db/schema/collection";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { researchReports } from "@/db/schema/research/reports";
import {
  researchCollectedItemDistricts,
  researchCollectedItemTopics,
} from "@/db/schema/research/annotations";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { researchTopics } from "@/db/schema/research/research-topics";
import type { ReportSearchSnapshot } from "@/db/schema/research/reports";
import type { ExcelAppendixRow } from "@/lib/research/report-excel-builder";

import { computeReportAggregates } from "@/lib/research/report-aggregator";
import { renderTemplateBrief } from "@/lib/research/report-template";
import {
  ReportParagraphsSchema,
  buildUserMessage,
  buildFallbackParagraphs,
  type ReportParagraphs,
  type PromptInput,
} from "@/lib/research/report-prompts";
import {
  renderReportHtml,
  type AppendixRow,
} from "@/lib/research/report-html-renderer";
import { updateReportStatus } from "@/lib/dal/research/reports";
import { assembleAgent } from "@/lib/agent/assembly";
import { getLanguageModel } from "@/lib/agent/model-router";

export const researchReportGenerate = inngest.createFunction(
  {
    id: "research-report-generate",
    concurrency: { limit: 3 },
    retries: 3,
  },
  { event: "research/report.generate" },
  async ({ event, step, logger }) => {
    const { reportId, organizationId } = event.data;

    // ─── Mark started ───────────────────────────────────────────────
    await step.run("mark-started", async () => {
      await updateReportStatus(reportId, {
        status: "generating",
        currentStep: "数据聚合",
        startedAt: new Date(),
        errorMessage: null,
      });
    });

    // ─── Step 1: load + aggregate ───────────────────────────────────
    const step1 = await step.run("step-1-aggregate", async () => {
      const [report] = await db
        .select({
          snapshot: researchReports.searchSnapshot,
          title: researchReports.title,
          topicDescription: researchReports.topicDescription,
        })
        .from(researchReports)
        .where(
          and(
            eq(researchReports.id, reportId),
            eq(researchReports.organizationId, organizationId),
          ),
        );
      if (!report) throw new Error(`report ${reportId} not found in org ${organizationId}`);

      const snap = report.snapshot as ReportSearchSnapshot;
      const hitItemIds = snap.hitItemIds ?? [];
      if (hitItemIds.length === 0) {
        await updateReportStatus(reportId, {
          status: "failed",
          errorMessage: "命中数据为空，无法生成报告",
          currentStep: null,
        });
        throw new Error("HIT_ITEMS_EMPTY");
      }

      try {
        const aggregates = await computeReportAggregates(organizationId, hitItemIds);
        // 写 aggregatesJson 到 DB（让前端 polling 看到聚合阶段已完成）
        await updateReportStatus(reportId, { aggregatesJson: aggregates });
        return {
          aggregates,
          snapshot: snap,
          title: report.title,
          topicDescription: report.topicDescription,
          drift: { original: hitItemIds.length, alive: aggregates.hitCount },
        };
      } catch (err) {
        if (err instanceof Error && err.message === "HIT_ITEMS_ALL_DELETED") {
          await updateReportStatus(reportId, {
            status: "failed",
            errorMessage: "命中数据已被全部删除，无法重生报告",
            currentStep: null,
          });
        }
        throw err;
      }
    });

    // ─── Step 2: render template brief ──────────────────────────────
    const templateBrief = await step.run("step-2-template", async () => {
      await updateReportStatus(reportId, { currentStep: "模板插值" });
      const snap = step1.snapshot;
      const start = pickRangeStart(snap);
      const end = pickRangeEnd(snap);
      return renderTemplateBrief(step1.aggregates, {
        timeRangeStart: start,
        timeRangeEnd: end,
        topicDescription: step1.topicDescription ?? undefined,
        districtCount: step1.aggregates.districtDistribution.length,
        topicCount: step1.aggregates.topicDistribution.length,
      });
    });

    // ─── Step 3: AI generate paragraphs (with fallback) ─────────────
    const step3 = await step.run("step-3-ai", async () => {
      await updateReportStatus(reportId, { currentStep: "小研撰写中" });

      // 取 5 条命中文章标题作为 sample（防 prompt 过长，截前 5）
      const sampleRows = await db
        .select({ title: collectedItems.title })
        .from(collectedItems)
        .where(
          and(
            eq(collectedItems.organizationId, organizationId),
            inArray(collectedItems.id, step1.snapshot.hitItemIds.slice(0, 5)),
          ),
        )
        .limit(5);

      const promptInput: PromptInput = {
        title: step1.title,
        topicDescription: step1.topicDescription ?? undefined,
        timeRangeStart: pickRangeStart(step1.snapshot),
        timeRangeEnd: pickRangeEnd(step1.snapshot),
        aggregates: step1.aggregates,
        templateBrief,
        sampleTitles: sampleRows.map((s) => s.title),
      };

      // 找 xiaoyan employee（A6 已 seed）— 找不到就走 fallback（不阻塞主流程）
      const xiaoyan = await db.query.aiEmployees.findFirst({
        where: and(
          eq(aiEmployees.organizationId, organizationId),
          eq(aiEmployees.slug, "xiaoyan"),
        ),
      });

      if (!xiaoyan) {
        logger.warn(
          `[a5][step-3] xiaoyan employee not seeded in org ${organizationId} — A6 dependency missing, falling back to template`,
        );
        return {
          paragraphs: buildFallbackParagraphs(promptInput),
          isAiFallback: true,
        };
      }

      try {
        const agent = await assembleAgent(xiaoyan.id, undefined, {
          skillOverrides: ["report_drafter"],
        });

        const { output } = await generateText({
          model: getLanguageModel(agent.modelConfig),
          system: agent.systemPrompt,
          prompt: buildUserMessage(promptInput),
          output: Output.object({ schema: ReportParagraphsSchema }),
          temperature: 0.3,
          maxOutputTokens: 4000,
        });

        if (!output) {
          throw new Error("generateText returned no output");
        }

        return {
          paragraphs: output as ReportParagraphs,
          isAiFallback: false,
        };
      } catch (err) {
        logger.error(
          `[a5][step-3] LLM failed, falling back to template: ${err instanceof Error ? err.message : String(err)}`,
        );
        return {
          paragraphs: buildFallbackParagraphs(promptInput),
          isAiFallback: true,
        };
      }
    });

    // ─── Step 4: render HTML ────────────────────────────────────────
    await step.run("step-4-render-html", async () => {
      await updateReportStatus(reportId, { currentStep: "渲染 HTML" });

      // 拼附录数据（leftJoin outlet + districts annotation；title/url/outletTier/publishedAt 直接来自 collected_items）
      // 一个 item 可能有多个 district annotation → group by itemId 后取首个 district 作为附录显示。
      const annotationRows = await db
        .select({
          id: collectedItems.id,
          title: collectedItems.title,
          outletTier: collectedItems.outletTier,
          publishedAt: collectedItems.publishedAt,
          url: collectedItems.canonicalUrl,
          outletName: mediaOutletDictionary.outletName,
          districtName: cqDistricts.name,
        })
        .from(collectedItems)
        .leftJoin(
          mediaOutletDictionary,
          and(
            eq(mediaOutletDictionary.id, collectedItems.outletId),
            eq(mediaOutletDictionary.organizationId, collectedItems.organizationId),
          ),
        )
        .leftJoin(
          researchCollectedItemDistricts,
          eq(researchCollectedItemDistricts.collectedItemId, collectedItems.id),
        )
        .leftJoin(
          cqDistricts,
          eq(cqDistricts.id, researchCollectedItemDistricts.districtId),
        )
        .where(
          and(
            eq(collectedItems.organizationId, organizationId),
            inArray(collectedItems.id, step1.snapshot.hitItemIds),
          ),
        );

      // group by itemId — 多 district 取第一个非空
      const appendixMap = new Map<string, AppendixRow>();
      for (const row of annotationRows) {
        const existing = appendixMap.get(row.id);
        if (!existing) {
          appendixMap.set(row.id, {
            id: row.id,
            title: row.title || "(无标题)",
            outletName: row.outletName,
            outletTier: row.outletTier,
            districtName: row.districtName,
            publishedAt: row.publishedAt
              ? row.publishedAt.toISOString().slice(0, 10)
              : null,
            url: row.url,
          });
        } else if (!existing.districtName && row.districtName) {
          // 补 district name（首条 join 返 null 时）
          existing.districtName = row.districtName;
        }
      }

      const appendix = Array.from(appendixMap.values()).sort((a, b) => {
        // 按 publishedAt 升序（null 放后）
        if (a.publishedAt === b.publishedAt) return 0;
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return a.publishedAt.localeCompare(b.publishedAt);
      });

      const aggregatesWithFlag = {
        ...step1.aggregates,
        isAiFallback: step3.isAiFallback,
      };

      const html = renderReportHtml({
        title: step1.title,
        topicDescription: step1.topicDescription ?? undefined,
        timeRangeStart: pickRangeStart(step1.snapshot),
        timeRangeEnd: pickRangeEnd(step1.snapshot),
        completedAt: new Date().toISOString(),
        paragraphs: step3.paragraphs,
        aggregates: aggregatesWithFlag,
        appendix,
        isAiFallback: step3.isAiFallback,
        drift:
          step1.drift.original !== step1.drift.alive ? step1.drift : undefined,
      });

      await updateReportStatus(reportId, {
        reportHtml: html,
        aggregatesJson: aggregatesWithFlag,
      });
    });

    // ─── Step 5: generate Word ─────────────────────────────────────
    // Spec §4.2: Word 失败不阻塞主流程，仅 disable 导出按钮。
    // 失败仅 console.error + 跳过 wordFileUrl 写入，不抛错。
    await step.run("step-5-word", async () => {
      await updateReportStatus(reportId, { currentStep: "生成 Word" });
      try {
        const { buildReportDocx } = await import("@/lib/research/report-word-builder");
        const { uploadFile, getSignedUrl, buildObjectPath } = await import(
          "@/lib/research/report-storage"
        );

        const hitItemIds = step1.snapshot.hitItemIds;

        // 附录基础数据（leftJoin outlet）
        const appendix = await db
          .select({
            id: collectedItems.id,
            title: collectedItems.title,
            outletName: mediaOutletDictionary.outletName,
            outletTier: collectedItems.outletTier,
            publishedAt: collectedItems.publishedAt,
          })
          .from(collectedItems)
          .leftJoin(
            mediaOutletDictionary,
            and(
              eq(mediaOutletDictionary.id, collectedItems.outletId),
              eq(
                mediaOutletDictionary.organizationId,
                collectedItems.organizationId,
              ),
            ),
          )
          .where(
            and(
              eq(collectedItems.organizationId, organizationId),
              inArray(collectedItems.id, hitItemIds),
            ),
          );

        // join 命中区县（多对多）→ Map<itemId, Set<districtName>>
        // 多区县时折叠成 "name1、name2"（A5 Plan Phase 6 Task 6.3.1 B-1 修复）
        const districtRows = hitItemIds.length
          ? await db
              .select({
                itemId: researchCollectedItemDistricts.collectedItemId,
                districtName: cqDistricts.name,
              })
              .from(researchCollectedItemDistricts)
              .leftJoin(
                cqDistricts,
                eq(researchCollectedItemDistricts.districtId, cqDistricts.id),
              )
              .where(
                inArray(
                  researchCollectedItemDistricts.collectedItemId,
                  hitItemIds,
                ),
              )
          : [];
        const districtsByItem = new Map<string, Set<string>>();
        for (const r of districtRows) {
          if (!r.districtName) continue;
          const slot = districtsByItem.get(r.itemId) ?? new Set<string>();
          slot.add(r.districtName);
          districtsByItem.set(r.itemId, slot);
        }

        const sortedAppendix = [...appendix].sort((a, b) => {
          const aTime = a.publishedAt ? a.publishedAt.getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.publishedAt ? b.publishedAt.getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });

        const aggregatesWithFlag = {
          ...step1.aggregates,
          isAiFallback: step3.isAiFallback,
        };

        const buf = await buildReportDocx({
          title: step1.title,
          topicDescription: step1.topicDescription ?? undefined,
          timeRangeStart: pickRangeStart(step1.snapshot),
          timeRangeEnd: pickRangeEnd(step1.snapshot),
          completedAt: new Date().toISOString(),
          paragraphs: step3.paragraphs,
          aggregates: aggregatesWithFlag,
          appendix: sortedAppendix.map((r) => {
            const set = districtsByItem.get(r.id);
            const districtName =
              set && set.size > 0 ? Array.from(set).join("、") : null;
            return {
              title: r.title || "(无标题)",
              outletName: r.outletName,
              outletTier: r.outletTier,
              districtName,
              publishedAt: r.publishedAt
                ? r.publishedAt.toISOString().slice(0, 10)
                : null,
            };
          }),
        });

        const objectPath = buildObjectPath(organizationId, reportId, "report.docx");
        await uploadFile(
          objectPath,
          buf,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
        const signed = await getSignedUrl(objectPath);
        await updateReportStatus(reportId, {
          wordFileUrl: signed.url,
          fileExpiresAt: signed.expiresAt,
        });
      } catch (err) {
        // Spec §4.2: Word 失败不阻塞主流程，仅 disable 导出按钮 + tooltip "Word 生成失败"
        logger.error(
          `[a5][step-5-word] 失败（不阻塞主流程）: ${err instanceof Error ? err.message : String(err)}`,
        );
        // wordFileUrl 保持 null（schema 默认），前端通过缺值 disable 按钮
      }
    });

    // ─── Step 6: generate Excel ─────────────────────────────────────
    // Spec §4.2: Excel 失败不阻塞主流程，仅 disable 导出按钮。
    // 失败仅 logger.error + 跳过 excelFileUrl 写入，不抛错。
    // 附录 join 重新跑（跨 step 不能共享变量；性能影响 < 100ms 可接受）。
    await step.run("step-6-excel", async () => {
      await updateReportStatus(reportId, { currentStep: "生成 Excel" });
      try {
        const { buildReportXlsx } = await import("@/lib/research/report-excel-builder");
        const { uploadFile, getSignedUrl, buildObjectPath } = await import(
          "@/lib/research/report-storage"
        );

        const hitItemIds = step1.snapshot.hitItemIds;

        // 附录基础数据（leftJoin outlet）
        const appendixBase = await db
          .select({
            id: collectedItems.id,
            title: collectedItems.title,
            outletName: mediaOutletDictionary.outletName,
            outletTier: collectedItems.outletTier,
            outletRegion: collectedItems.outletRegion,
            publishedAt: collectedItems.publishedAt,
            firstSeenAt: collectedItems.firstSeenAt,
            url: collectedItems.canonicalUrl,
            contentType: collectedItems.contentType,
          })
          .from(collectedItems)
          .leftJoin(
            mediaOutletDictionary,
            and(
              eq(mediaOutletDictionary.id, collectedItems.outletId),
              eq(
                mediaOutletDictionary.organizationId,
                collectedItems.organizationId,
              ),
            ),
          )
          .where(
            and(
              eq(collectedItems.organizationId, organizationId),
              inArray(collectedItems.id, hitItemIds),
            ),
          );

        // join 命中区县（多对多）→ Map<itemId, Set<districtName>>
        const districtRows = hitItemIds.length
          ? await db
              .select({
                itemId: researchCollectedItemDistricts.collectedItemId,
                districtName: cqDistricts.name,
              })
              .from(researchCollectedItemDistricts)
              .leftJoin(
                cqDistricts,
                eq(researchCollectedItemDistricts.districtId, cqDistricts.id),
              )
              .where(
                inArray(
                  researchCollectedItemDistricts.collectedItemId,
                  hitItemIds,
                ),
              )
          : [];
        const districtsByItem = new Map<string, Set<string>>();
        for (const r of districtRows) {
          if (!r.districtName) continue;
          const slot = districtsByItem.get(r.itemId) ?? new Set<string>();
          slot.add(r.districtName);
          districtsByItem.set(r.itemId, slot);
        }

        // join 命中主题（多对多）→ Map<itemId, Set<topicName>>
        const topicRows = hitItemIds.length
          ? await db
              .select({
                itemId: researchCollectedItemTopics.collectedItemId,
                topicName: researchTopics.name,
              })
              .from(researchCollectedItemTopics)
              .leftJoin(
                researchTopics,
                eq(researchCollectedItemTopics.topicId, researchTopics.id),
              )
              .where(
                inArray(
                  researchCollectedItemTopics.collectedItemId,
                  hitItemIds,
                ),
              )
          : [];
        const topicsByItem = new Map<string, Set<string>>();
        for (const r of topicRows) {
          if (!r.topicName) continue;
          const slot = topicsByItem.get(r.itemId) ?? new Set<string>();
          slot.add(r.topicName);
          topicsByItem.set(r.itemId, slot);
        }

        // 按 publishedAt 升序（null 放后），与 Word 附录顺序一致
        const sortedAppendix = [...appendixBase].sort((a, b) => {
          const aTime = a.publishedAt ? a.publishedAt.getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.publishedAt ? b.publishedAt.getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });

        const excelAppendix: ExcelAppendixRow[] = sortedAppendix.map((r) => ({
          title: r.title || "(无标题)",
          outletName: r.outletName,
          outletTier: r.outletTier,
          outletRegion: r.outletRegion,
          districtNames: Array.from(districtsByItem.get(r.id) ?? []),
          topicNames: Array.from(topicsByItem.get(r.id) ?? []),
          publishedAt: r.publishedAt
            ? r.publishedAt.toISOString().slice(0, 10)
            : null,
          firstSeenAt: r.firstSeenAt
            ? r.firstSeenAt.toISOString().slice(0, 10)
            : null,
          url: r.url,
          contentType: r.contentType,
        }));

        const aggregatesWithFlag = {
          ...step1.aggregates,
          isAiFallback: step3.isAiFallback,
        };

        const buf = buildReportXlsx({
          aggregates: aggregatesWithFlag,
          appendix: excelAppendix,
        });

        const objectPath = buildObjectPath(organizationId, reportId, "report.xlsx");
        await uploadFile(
          objectPath,
          buf,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        const signed = await getSignedUrl(objectPath);
        // 仅写 excelFileUrl；fileExpiresAt 由 Step 5 已写入（两文件共用 24h TTL，
        // 同 step run 时间近似一致；如 Step 5 因故未写则 Step 6 也补一份）。
        await updateReportStatus(reportId, {
          excelFileUrl: signed.url,
          fileExpiresAt: signed.expiresAt,
        });
      } catch (err) {
        // Spec §4.2: Excel 失败不阻塞主流程，仅 disable 导出按钮 + tooltip "Excel 生成失败"
        logger.error(
          `[a5][step-6-excel] 失败（不阻塞主流程）: ${err instanceof Error ? err.message : String(err)}`,
        );
        // excelFileUrl 保持 null（schema 默认），前端通过缺值 disable 按钮
      }
    });

    // ─── Step 7: finalize ───────────────────────────────────────────
    await step.run("step-7-finalize", async () => {
      await updateReportStatus(reportId, {
        status: "ready",
        currentStep: null,
        completedAt: new Date(),
      });
    });

    return { reportId, ok: true, isAiFallback: step3.isAiFallback };
  },
);

// ── helpers ────────────────────────────────────────────────────────

function pickRangeStart(snap: ReportSearchSnapshot): string {
  return snap.kind === "research_task" ? snap.timeRange.start : snap.capturedAt;
}

function pickRangeEnd(snap: ReportSearchSnapshot): string {
  return snap.kind === "research_task" ? snap.timeRange.end : snap.capturedAt;
}

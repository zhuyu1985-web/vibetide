/**
 * Task 0.6 — Golden Mission baseline capture
 *
 * 对 6 个代表性 scenario 运行当前的 Leader prompt builder
 * (`buildLeaderDecomposePrompt`，位于 `src/lib/mission-core.ts`)，
 * 把结果保存到 `docs/golden-missions/2026-04-20-baseline.json`，供 Phase 4
 * 重构后做 semantic diff 对比，确保 Leader 行为无不可接受回归。
 *
 * 取样策略（3 路 fallback）:
 *  1. 优先从 DB `missions` 表按 scenario 拉真实 demo mission（只取首条）
 *  2. DB 无数据 → 构造合成 mission + 合成 employees 数组，仍调用 builder
 *  3. builder throw / DB 不可达 → 记录 note 并继续其它 scenario
 *
 * Usage:
 *   npx tsx scripts/capture-golden-mission-baseline.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "node:fs";
import path from "node:path";

import { buildLeaderDecomposePrompt } from "@/lib/mission-core";

const SCENARIOS = [
  "breaking_news",
  "press_conference",
  "daily_brief",
  "video_content",
  "deep_report",
  "custom",
] as const;

type ScenarioSlug = (typeof SCENARIOS)[number];

const PROMPT_BUILDER_SOURCE =
  "src/lib/mission-core.ts:buildLeaderDecomposePrompt";
const PROMPT_BUILDER_SIGNATURE =
  "(mission: { userInstruction: string; scenario: string; title: string }, employeesWithSkills: Array<{ slug, name, nickname, title, skills: string[] }>) => string";

// -------------------------------------------------------------------------
// Synthetic fallback data — used when DB is unreachable or has no demo row
// for a given scenario. Keep values representative but static so Phase 4
// regression diff is stable.
// -------------------------------------------------------------------------

const SYNTHETIC_EMPLOYEES = [
  {
    id: "syn-emp-xiaolei",
    slug: "xiaolei",
    name: "热点分析师",
    nickname: "热点分析师",
    title: "热点分析师",
    skills: ["热点监控", "趋势识别", "平台数据分析"],
  },
  {
    id: "syn-emp-xiaoce",
    slug: "xiaoce",
    name: "选题策划师",
    nickname: "选题策划师",
    title: "选题策划师",
    skills: ["选题策划", "角度设计", "标题优化"],
  },
  {
    id: "syn-emp-xiaozi",
    slug: "xiaozi",
    name: "素材研究员",
    nickname: "素材研究员",
    title: "素材研究员",
    skills: ["资料检索", "多源整合", "数据核验"],
  },
  {
    id: "syn-emp-xiaowen",
    slug: "xiaowen",
    name: "稿件撰写师",
    nickname: "稿件撰写师",
    title: "稿件撰写师",
    skills: ["深度写作", "短讯撰写", "改写编辑"],
  },
  {
    id: "syn-emp-xiaojian",
    slug: "xiaojian",
    name: "视频制作师",
    nickname: "视频制作师",
    title: "视频制作师",
    skills: ["视频剪辑", "脚本分镜", "字幕配音"],
  },
  {
    id: "syn-emp-xiaoshen",
    slug: "xiaoshen",
    name: "内容审核师",
    nickname: "内容审核师",
    title: "内容审核师",
    skills: ["合规审核", "事实核查", "敏感词过滤"],
  },
  {
    id: "syn-emp-xiaofa",
    slug: "xiaofa",
    name: "渠道分发师",
    nickname: "渠道分发师",
    title: "渠道分发师",
    skills: ["多平台适配", "CMS 入库", "定时发布"],
  },
  {
    id: "syn-emp-xiaoshu",
    slug: "xiaoshu",
    name: "数据分析师",
    nickname: "数据分析师",
    title: "数据分析师",
    skills: ["传播数据分析", "效果复盘", "报表生成"],
  },
];

const SYNTHETIC_MISSIONS: Record<
  ScenarioSlug,
  { title: string; userInstruction: string }
> = {
  breaking_news: {
    title: "突发新闻快讯 · 合成基线样本",
    userInstruction:
      "刚刚监测到某市发生交通事故，请在 30 分钟内出一条 300 字快讯，附 1 张示意图片和 3 家媒体平台分发。",
  },
  press_conference: {
    title: "新闻发布会深度报道 · 合成基线样本",
    userInstruction:
      "国务院新闻办下午 3 点召开发布会，主题为新能源汽车补贴政策调整。请产出通稿、短视频、官微速评各 1 条。",
  },
  daily_brief: {
    title: "每日简报 · 合成基线样本",
    userInstruction:
      "整理今日 8:00-18:00 全网科技行业 10 条要闻，按重要性排序生成简报，附 3 张趋势图。",
  },
  video_content: {
    title: "短视频栏目 · 合成基线样本",
    userInstruction:
      "围绕最近热门的 AI 芯片话题，策划并制作一条 60 秒短视频，包含脚本、分镜、旁白文本。",
  },
  deep_report: {
    title: "深度报道 · 合成基线样本",
    userInstruction:
      "围绕今年两会经济政策核心议题，完成 3000 字深度报道：背景、数据、专家观点、结论。",
  },
  custom: {
    title: "自定义任务 · 合成基线样本",
    userInstruction:
      "我们需要一份面向 Z 世代用户的音乐节活动传播方案，包含 5 个平台的差异化内容策略。",
  },
};

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

interface ScenarioCapture {
  source: "db" | "synthetic" | "skipped";
  missionId?: string;
  scenario: string;
  title?: string;
  userInstruction?: string;
  employeeCount?: number;
  prompt?: string;
  note?: string;
}

async function loadEmployeesFromDb(
  organizationId: string
): Promise<Array<{
  id: string;
  slug: string;
  name: string;
  nickname: string;
  title: string;
  skills: string[];
}> | null> {
  try {
    // Dynamically import DB so script can still produce an empty baseline
    // skeleton when DATABASE_URL is missing.
    const mission = await import("@/lib/mission-core");
    const rows = await mission.loadAvailableEmployees(organizationId);
    return rows;
  } catch (e) {
    console.warn(
      "[baseline] loadAvailableEmployees failed:",
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }
}

async function tryLoadMissionsFromDb(): Promise<{
  rowsByScenario: Map<string, { id: string; scenario: string; userInstruction: string; title: string; organizationId: string }>;
  available: boolean;
  error?: string;
}> {
  const rowsByScenario = new Map<
    string,
    {
      id: string;
      scenario: string;
      userInstruction: string;
      title: string;
      organizationId: string;
    }
  >();

  if (!process.env.DATABASE_URL) {
    return {
      rowsByScenario,
      available: false,
      error: "DATABASE_URL not set — skipping DB lookup",
    };
  }

  try {
    const [{ db }, schema, drizzle] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);

    const { missions } = schema;
    const { inArray } = drizzle;

    const rows = await db
      .select({
        id: missions.id,
        scenario: missions.scenario,
        userInstruction: missions.userInstruction,
        title: missions.title,
        organizationId: missions.organizationId,
      })
      .from(missions)
      .where(inArray(missions.scenario, SCENARIOS as unknown as string[]));

    for (const r of rows) {
      if (!rowsByScenario.has(r.scenario)) {
        rowsByScenario.set(r.scenario, r);
      }
    }
    return { rowsByScenario, available: true };
  } catch (e) {
    return {
      rowsByScenario,
      available: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  const baseline: {
    capturedAt: string;
    promptBuilderSource: string;
    promptBuilderSignature: string;
    dbAvailable: boolean;
    dbError?: string;
    scenarios: Record<string, ScenarioCapture>;
  } = {
    capturedAt: new Date().toISOString(),
    promptBuilderSource: PROMPT_BUILDER_SOURCE,
    promptBuilderSignature: PROMPT_BUILDER_SIGNATURE,
    dbAvailable: false,
    scenarios: {},
  };

  const dbResult = await tryLoadMissionsFromDb();
  baseline.dbAvailable = dbResult.available;
  if (dbResult.error) baseline.dbError = dbResult.error;

  for (const slug of SCENARIOS) {
    const dbRow = dbResult.rowsByScenario.get(slug);

    try {
      if (dbRow) {
        // Try loading real employees for that org
        const dbEmployees = await loadEmployeesFromDb(dbRow.organizationId);
        const employees =
          dbEmployees && dbEmployees.length > 0
            ? dbEmployees
            : SYNTHETIC_EMPLOYEES;

        const prompt = buildLeaderDecomposePrompt(
          {
            userInstruction: dbRow.userInstruction,
            scenario: dbRow.scenario,
            title: dbRow.title,
          },
          employees
        );

        baseline.scenarios[slug] = {
          source: "db",
          missionId: dbRow.id,
          scenario: dbRow.scenario,
          title: dbRow.title,
          userInstruction: dbRow.userInstruction,
          employeeCount: employees.length,
          prompt,
        };
      } else {
        // Synthetic fallback
        const syn = SYNTHETIC_MISSIONS[slug];
        const prompt = buildLeaderDecomposePrompt(
          {
            userInstruction: syn.userInstruction,
            scenario: slug,
            title: syn.title,
          },
          SYNTHETIC_EMPLOYEES
        );
        baseline.scenarios[slug] = {
          source: "synthetic",
          scenario: slug,
          title: syn.title,
          userInstruction: syn.userInstruction,
          employeeCount: SYNTHETIC_EMPLOYEES.length,
          prompt,
          note: dbResult.available
            ? "no demo mission found in DB for this scenario, used synthetic sample"
            : "DB unavailable, used synthetic sample",
        };
      }
    } catch (e) {
      baseline.scenarios[slug] = {
        source: "skipped",
        scenario: slug,
        note:
          "prompt builder threw: " +
          (e instanceof Error ? e.message : String(e)),
      };
    }
  }

  const outDir = path.resolve(process.cwd(), "docs/golden-missions");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "2026-04-20-baseline.json");
  fs.writeFileSync(outFile, JSON.stringify(baseline, null, 2));

  console.log(
    "[baseline] captured",
    SCENARIOS.length,
    "scenarios; output:",
    outFile
  );
  console.log("[baseline] dbAvailable:", baseline.dbAvailable);
  if (baseline.dbError) console.log("[baseline] dbError:", baseline.dbError);
  for (const s of SCENARIOS) {
    const cap = baseline.scenarios[s];
    console.log(`  ${s}: source=${cap.source}${cap.note ? ` | ${cap.note}` : ""}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[baseline] fatal:", e);
  // Even on fatal error, try to leave an empty skeleton so Phase 4 diff
  // has a known shape to compare against.
  try {
    const outDir = path.resolve(process.cwd(), "docs/golden-missions");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "2026-04-20-baseline.json");
    if (!fs.existsSync(outFile)) {
      fs.writeFileSync(
        outFile,
        JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            promptBuilderSource: PROMPT_BUILDER_SOURCE,
            promptBuilderSignature: PROMPT_BUILDER_SIGNATURE,
            dbAvailable: false,
            note: "fatal error during capture: " + String(e),
            scenarios: {},
          },
          null,
          2
        )
      );
    }
  } catch {}
  process.exit(1);
});

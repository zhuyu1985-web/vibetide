/**
 * scripts/export-media-dict-to-xlsx.ts
 *
 * 把 media_outlet_dictionary 当前状态 1:1 导出为 Excel 模板,
 * 供运营在 Excel 里维护数据,然后通过 import 脚本回写 DB。
 *
 * 设计:
 *   - 单 sheet"媒体字典"+ 长格式 (1 行 = 1 个 channel)
 *   - 同一 outlet 的多个 channel 占多行,媒体名 / 分级 / 区域 等元数据
 *     在每行都重复(便于 Excel 操作 + import 不需要"继承上下文")
 *   - 没有任何 channel 的 outlet 也会占 1 行(平台/识别符/URL 留空)
 *   - 标题行带中文 + 字段说明注释
 *
 * 列 schema (按 DB 字段对齐):
 *   - 媒体名         (outlet_name)
 *   - 分级           (outlet_tier 中文标签)
 *   - 集团/上级单位  (group_name)
 *   - 区域           (outlet_region)
 *   - 区县           (outlet_district)
 *   - 行业           (industry_tag)
 *   - 描述           (description)
 *   - 状态           (is_active → "启用"/"停用")
 *   - 平台           (channel.type 中文标签)
 *   - 账号名         (nickname / name / domain)
 *   - 识别符         (secUid / uid / userId / ghid / domain - 视平台不同)
 *   - 主页 URL       (profileUrl / url / qrcodeUrl)
 *   - 备注           (备注列,导出空)
 *
 * 用法:
 *   DATABASE_URL=... pnpm tsx scripts/export-media-dict-to-xlsx.ts
 *   # 默认输出 docs/media-dict-template.xlsx
 *   pnpm tsx scripts/export-media-dict-to-xlsx.ts --out path/to/file.xlsx
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { asc } from "drizzle-orm";
import { OUTLET_TIER_LABELS } from "@/lib/collection/constants";
import {
  CHANNEL_TYPE_LABELS,
  getChannelDisplayName,
  getChannelIdentifier,
  type Channel,
  type ChannelType,
} from "@/lib/media-outlet/channels";

const args = process.argv.slice(2);
const outPath = (() => {
  const i = args.indexOf("--out");
  return i >= 0 ? args[i + 1]! : "docs/media-dict-template.xlsx";
})();

const TIER_LABEL: Record<string, string> = OUTLET_TIER_LABELS as Record<string, string>;

interface ExcelRow {
  媒体名: string;
  分级: string;
  "集团/上级单位": string;
  区域: string;
  区县: string;
  行业: string;
  描述: string;
  状态: string;
  平台: string;
  账号名: string;
  识别符: string;
  "主页 URL": string;
  备注: string;
}

function getChannelUrl(c: Channel): string {
  switch (c.type) {
    case "website":
      return c.url;
    case "wechat_oa":
      return c.qrcodeUrl ?? "";
    case "douyin":
    case "weibo":
    case "kuaishou":
      return c.profileUrl ?? "";
  }
}

async function main() {
  const outlets = await db
    .select()
    .from(mediaOutletDictionary)
    .orderBy(
      asc(mediaOutletDictionary.outletTier),
      asc(mediaOutletDictionary.outletRegion),
      asc(mediaOutletDictionary.outletName),
    );

  console.log(`📋 共 ${outlets.length} 个 outlet`);

  const rows: ExcelRow[] = [];

  for (const o of outlets) {
    const baseMeta = {
      媒体名: o.outletName,
      分级: TIER_LABEL[o.outletTier] ?? o.outletTier,
      "集团/上级单位": o.groupName ?? "",
      区域: o.outletRegion ?? "",
      区县: o.outletDistrict ?? "",
      行业: o.industryTag ?? "",
      描述: o.description ?? "",
      状态: o.isActive ? "启用" : "停用",
    };

    const channels = (o.channels ?? []) as Channel[];

    if (channels.length === 0) {
      // 没有 channel 的 outlet 也占一行(平台/账号留空)
      rows.push({
        ...baseMeta,
        平台: "",
        账号名: "",
        识别符: "",
        "主页 URL": "",
        备注: "",
      });
      continue;
    }

    for (const c of channels) {
      rows.push({
        ...baseMeta,
        平台: CHANNEL_TYPE_LABELS[c.type as ChannelType],
        账号名: getChannelDisplayName(c),
        识别符: getChannelIdentifier(c) ?? "",
        "主页 URL": getChannelUrl(c),
        备注: "",
      });
    }
  }

  console.log(`📊 共 ${rows.length} 个 channel 行 (含 ${outlets.filter((o) => !(o.channels ?? []).length).length} 个空 outlet)`);

  // 生成 worksheet
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "媒体名",
      "分级",
      "集团/上级单位",
      "区域",
      "区县",
      "行业",
      "描述",
      "状态",
      "平台",
      "账号名",
      "识别符",
      "主页 URL",
      "备注",
    ],
  });

  // 设置列宽
  ws["!cols"] = [
    { wch: 24 }, // 媒体名
    { wch: 10 }, // 分级
    { wch: 16 }, // 集团
    { wch: 8 },  // 区域
    { wch: 10 }, // 区县
    { wch: 12 }, // 行业
    { wch: 30 }, // 描述
    { wch: 6 },  // 状态
    { wch: 12 }, // 平台
    { wch: 20 }, // 账号名
    { wch: 30 }, // 识别符
    { wch: 50 }, // URL
    { wch: 20 }, // 备注
  ];

  // 创建说明 sheet
  const helpRows = [
    { 字段: "媒体名", 必填: "是", 说明: "唯一,如'人民日报'。修改名字时系统认为是另一家媒体。" },
    { 字段: "分级", 必填: "是", 说明: "央级 / 省/市级 / 行业 / 区县融媒 / 政务新媒体" },
    { 字段: "集团/上级单位", 必填: "否", 说明: "可选,用于聚合(如'重庆日报报业集团下属')。空着也行。" },
    { 字段: "区域", 必填: "否", 说明: "如'全国' / '重庆' / '江苏'" },
    { 字段: "区县", 必填: "区县融媒/政务必填", 说明: "如'九龙坡区' / '云阳县'" },
    { 字段: "行业", 必填: "行业媒体必填", 说明: "如'生态环境' / '教育' / '水利'" },
    { 字段: "描述", 必填: "否", 说明: "媒体简介,自由文本" },
    { 字段: "状态", 必填: "是", 说明: "'启用' 或 '停用'。停用的不会出现在采集源选择列表。" },
    { 字段: "平台", 必填: "有账号的行必填", 说明: "网站 / 微信公众号 / 抖音 / 微博 / 快手。同一媒体多账号占多行。媒体本身没有任何平台账号,这里留空。" },
    { 字段: "账号名", 必填: "平台非空时必填", 说明: "抖音/微博/快手:账号昵称(可调 tikhub 拿真实昵称)。微信公众号:公众号名。网站:域名。" },
    { 字段: "识别符", 必填: "tikhub 采集必填", 说明: "抖音:sec_user_id (MS4w...) ┃ 微博:uid 数字 ┃ 快手:userId (主页 URL 末段) ┃ 公众号:ghid (gh_xxx) ┃ 网站:域名" },
    { 字段: "主页 URL", 必填: "推荐填", 说明: "完整主页 URL。系统自动从 URL 解析识别符:'抖音主页粘贴助手'对所有平台都生效。网站填首页 URL。" },
    { 字段: "备注", 必填: "否", 说明: "运营备注,系统不读" },
    { 字段: "", 必填: "", 说明: "" },
    { 字段: "—— 同媒体多账号怎么填 ——", 必填: "", 说明: "同一媒体在多个平台有账号 → 每个账号占一行,媒体名/分级/区域 等元数据每行都重复填" },
    { 字段: "同平台多账号", 必填: "", 说明: "如'人民日报'抖音有'人民日报'+'人民日报评论'两个号 → 占两行,平台都填'抖音',账号名分别填" },
    { 字段: "—— 删除 ——", 必填: "", 说明: "导入时不会删除 DB 已有 channels。要停用一个 outlet,把状态列改为'停用'。要删一个 channel:目前需在 UI 上操作。" },
  ];
  const helpWs = XLSX.utils.json_to_sheet(helpRows, { header: ["字段", "必填", "说明"] });
  helpWs["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 80 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "媒体字典");
  XLSX.utils.book_append_sheet(wb, helpWs, "字段说明");

  XLSX.writeFile(wb, outPath);
  console.log(`\n✅ 导出: ${outPath}`);
  console.log(`\n下一步:`);
  console.log(`  - Excel 里增加/修改/删除行 → 保存`);
  console.log(`  - 跑 import 脚本(后续会做): pnpm tsx scripts/import-media-dict-from-xlsx.ts`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});

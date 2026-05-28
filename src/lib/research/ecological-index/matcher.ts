// 生态文明传播指数报告 - unit → outlet_id 反查算法
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.2.1
//
// 匹配优先级 (从高到低, 命中即停):
//   1. 公众号 ghid 精确匹配 (最强信号)
//   2. 微博 UID 精确匹配
//   3. 公众号名精确匹配
//   4. 网站域名精确匹配
//   5. outlet_name 模糊匹配 (双向 contains, 最弱信号)
//
// 反向冲突仲裁 (同一 outlet 被多 unit 命中):
//   1. unit.tier 优先级: central > industry > municipal > district_rmt > district_gov
//   2. 同 tier 下, unit.xlsxRow 升序 (先到先得)

import type { ScopeUnitTier } from "./types";

/**
 * 一个 unit (供 matcher 用的最小信息)
 */
export type MatchableUnit = {
  unitId: string; // 任意 unit 唯一 ID (DB scope_unit.id 或临时 idx 字符串)
  tier: ScopeUnitTier;
  xlsxRow: number;
  name: string;
  wechatNames: string[];
  wechatGhid: string | null;
  weiboUid: string | null;
  websites: string[]; // 域名格式 (cctv.com, paper.people.com.cn 等)
};

/**
 * outlet 字典行 (供 matcher 用的最小信息)
 */
export type OutletDictRow = {
  outletId: string; // media_outlet_dictionary.id
  outletName: string; // media_outlet_dictionary.outlet_name
  publicAccountNames: string[]; // public_account_names text[] (含 ghid + 公众号名混杂)
  domains: string[]; // domains text[]
};

/**
 * 单 unit ↔ outlet 匹配结果
 */
export type UnitMatchResult = {
  unitId: string;
  matched: Array<{
    outletId: string;
    signal: string; // 命中的信号描述 e.g. "ghid=gh_xxx" / "weibo_uid=12345" / "wechat_name=央视新闻"
    priority: 1 | 2 | 3 | 4 | 5;
  }>;
};

const TIER_RANK: Record<ScopeUnitTier, number> = {
  central: 0,
  industry: 1,
  municipal: 2,
  district_rmt: 3,
  district_gov: 4,
};

/**
 * 给一个 unit 找所有命中的 outlet (返回最高优先级信号)
 * 多个 outlet 命中 → 全部返回 (后续在 resolveOwnership 里反向裁决)
 */
export function matchUnitToOutlets(
  unit: MatchableUnit,
  dict: OutletDictRow[],
): UnitMatchResult {
  const candidates: Array<{
    outletId: string;
    signal: string;
    priority: 1 | 2 | 3 | 4 | 5;
  }> = [];

  for (const d of dict) {
    // 优先级 1: ghid 精确
    if (unit.wechatGhid && d.publicAccountNames.includes(unit.wechatGhid)) {
      candidates.push({
        outletId: d.outletId,
        signal: `ghid=${unit.wechatGhid}`,
        priority: 1,
      });
      continue;
    }
    // 优先级 2: weibo UID 精确
    if (unit.weiboUid && d.publicAccountNames.includes(unit.weiboUid)) {
      candidates.push({
        outletId: d.outletId,
        signal: `weibo_uid=${unit.weiboUid}`,
        priority: 2,
      });
      continue;
    }
    // 优先级 3: 公众号名精确
    let p3Hit = false;
    for (const wn of unit.wechatNames) {
      if (d.publicAccountNames.includes(wn)) {
        candidates.push({
          outletId: d.outletId,
          signal: `wechat_name=${wn}`,
          priority: 3,
        });
        p3Hit = true;
        break;
      }
    }
    if (p3Hit) continue;
    // 优先级 4: 网站域名精确
    let p4Hit = false;
    if (unit.websites.length > 0 && d.domains.length > 0) {
      const dictDomainsLower = d.domains.map((x) => x.toLowerCase());
      for (const ww of unit.websites) {
        const w = ww.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
        if (w && dictDomainsLower.includes(w)) {
          candidates.push({
            outletId: d.outletId,
            signal: `domain=${w}`,
            priority: 4,
          });
          p4Hit = true;
          break;
        }
      }
    }
    if (p4Hit) continue;
    // 优先级 5: outlet_name 双向 contains
    if (unit.name && d.outletName) {
      if (
        d.outletName === unit.name ||
        d.outletName.includes(unit.name) ||
        unit.name.includes(d.outletName)
      ) {
        candidates.push({
          outletId: d.outletId,
          signal: `name~${d.outletName}`,
          priority: 5,
        });
      }
    }
  }

  // 去重 同 outletId 保留最高优先级
  const dedup = new Map<
    string,
    { outletId: string; signal: string; priority: 1 | 2 | 3 | 4 | 5 }
  >();
  for (const c of candidates) {
    const prev = dedup.get(c.outletId);
    if (!prev || c.priority < prev.priority) dedup.set(c.outletId, c);
  }

  return {
    unitId: unit.unitId,
    matched: [...dedup.values()],
  };
}

/**
 * 反向冲突仲裁: 同一 outletId 被多个 unit 命中时, 决定归属哪个 unit
 *
 * 输入: 每个 unit 已用 matchUnitToOutlets 跑出 matched outletIds
 * 输出: outletId → owner unitId 的 map (每个 outlet 唯一归属一个 unit)
 *
 * 规则:
 *   1. tier 优先级: central > industry > municipal > district_rmt > district_gov
 *   2. 同 tier 下, xlsxRow 升序 (先到先得)
 */
export function resolveOutletOwnership(
  units: MatchableUnit[],
  unitMatches: UnitMatchResult[],
): Map<string, string> {
  // 倒排: outletId → 候选 unitIds[]
  const inv = new Map<string, string[]>();
  for (const m of unitMatches) {
    for (const c of m.matched) {
      const arr = inv.get(c.outletId) ?? [];
      arr.push(m.unitId);
      inv.set(c.outletId, arr);
    }
  }

  // unit 索引便于 lookup
  const unitMap = new Map<string, MatchableUnit>();
  for (const u of units) unitMap.set(u.unitId, u);

  const owner = new Map<string, string>();
  for (const [outletId, candidates] of inv.entries()) {
    if (candidates.length === 1) {
      owner.set(outletId, candidates[0]!);
      continue;
    }
    // 多候选, 按 tier rank + xlsxRow 排序
    const sorted = [...candidates].sort((a, b) => {
      const ua = unitMap.get(a)!;
      const ub = unitMap.get(b)!;
      const ta = TIER_RANK[ua.tier];
      const tb = TIER_RANK[ub.tier];
      if (ta !== tb) return ta - tb;
      return ua.xlsxRow - ub.xlsxRow;
    });
    owner.set(outletId, sorted[0]!);
  }

  return owner;
}

/**
 * 高层 API: 一次性跑完所有 unit → outlet 匹配 + 冲突仲裁
 * 返回每个 unit 的最终 outlet_id 列表 (经过冲突仲裁后, 这个 outlet 唯一归本 unit)
 */
export function matchScopeToOutlets(
  units: MatchableUnit[],
  dict: OutletDictRow[],
): Map<string, string[]> {
  const allMatches = units.map((u) => matchUnitToOutlets(u, dict));
  const ownership = resolveOutletOwnership(units, allMatches);

  // 反向倒排: unitId → 它拥有的 outletIds[]
  const unitToOutlets = new Map<string, string[]>();
  for (const u of units) unitToOutlets.set(u.unitId, []);
  for (const [outletId, ownerUnitId] of ownership.entries()) {
    const arr = unitToOutlets.get(ownerUnitId) ?? [];
    arr.push(outletId);
    unitToOutlets.set(ownerUnitId, arr);
  }
  return unitToOutlets;
}

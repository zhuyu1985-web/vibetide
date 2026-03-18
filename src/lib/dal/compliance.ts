import { db } from "@/db";
import { complianceChecks } from "@/db/schema/compliance";
import { eq, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Sensitive content detection rules (M2.F11)
// ---------------------------------------------------------------------------

interface ComplianceIssue {
  type: string;
  severity: "info" | "warning" | "critical";
  location: string;
  description: string;
  suggestion: string;
}

// Keyword categories for sensitive content detection
const SENSITIVE_RULES: {
  type: string;
  severity: "info" | "warning" | "critical";
  description: string;
  suggestion: string;
  keywords: string[];
}[] = [
  {
    type: "political",
    severity: "critical",
    description: "包含政治敏感词汇",
    suggestion: "请删除或替换相关敏感词汇，避免涉及政治敏感话题",
    keywords: [
      "颠覆",
      "分裂国家",
      "煽动",
      "反党",
      "反政府",
      "暴乱",
      "颜色革命",
      "政权更迭",
    ],
  },
  {
    type: "military",
    severity: "critical",
    description: "包含军事机密相关词汇",
    suggestion: "请删除涉及军事机密的内容，军事相关报道需经审批",
    keywords: [
      "军事机密",
      "绝密",
      "核武器",
      "导弹部署",
      "军事基地位置",
      "部队番号",
      "武器参数",
    ],
  },
  {
    type: "legal",
    severity: "warning",
    description: "包含法律风险词汇",
    suggestion: "请核实相关法律表述的准确性，建议咨询法务部门",
    keywords: [
      "诽谤",
      "造谣",
      "未经证实",
      "据传",
      "不可靠消息源",
      "爆料",
      "内幕消息",
    ],
  },
  {
    type: "vulgar",
    severity: "warning",
    description: "包含低俗或不当内容",
    suggestion: "请使用文明用语，保持内容的专业性",
    keywords: [
      "脏话",
      "骂人",
      "低俗",
      "色情",
      "黄色",
      "暴力描写",
      "血腥",
    ],
  },
  {
    type: "privacy",
    severity: "warning",
    description: "可能包含个人隐私信息",
    suggestion: "请对个人信息进行脱敏处理（如姓名、电话、地址等）",
    keywords: [
      "身份证号",
      "手机号码",
      "家庭住址",
      "银行卡号",
      "个人电话",
    ],
  },
  {
    type: "advertising",
    severity: "info",
    description: "可能包含广告或推广内容",
    suggestion: "如为广告内容请标注为'广告'或'推广'",
    keywords: [
      "限时优惠",
      "点击购买",
      "扫码领取",
      "免费领",
      "加微信",
      "优惠券",
    ],
  },
];

// Phone number and ID card patterns
const PRIVACY_PATTERNS: {
  pattern: RegExp;
  type: string;
  description: string;
  suggestion: string;
}[] = [
  {
    pattern: /1[3-9]\d{9}/g,
    type: "privacy",
    description: "检测到疑似手机号码",
    suggestion: "请对手机号码进行脱敏处理，如 138****1234",
  },
  {
    pattern: /\d{17}[\dXx]/g,
    type: "privacy",
    description: "检测到疑似身份证号码",
    suggestion: "请删除或脱敏处理身份证号码",
  },
  {
    pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
    type: "privacy",
    description: "检测到疑似银行卡号",
    suggestion: "请删除或脱敏处理银行卡号",
  },
];

/**
 * Run real-time compliance check on content text.
 * Uses keyword matching + regex patterns for sensitive content detection.
 */
export function checkContentCompliance(
  content: string,
  _orgId: string
): { issues: ComplianceIssue[]; isClean: boolean } {
  const issues: ComplianceIssue[] = [];

  // Keyword-based checks
  for (const rule of SENSITIVE_RULES) {
    for (const keyword of rule.keywords) {
      const index = content.indexOf(keyword);
      if (index !== -1) {
        // Find surrounding context (up to 20 chars before and after)
        const start = Math.max(0, index - 20);
        const end = Math.min(content.length, index + keyword.length + 20);
        const location = content.slice(start, end);

        issues.push({
          type: rule.type,
          severity: rule.severity,
          location: `...${location}...`,
          description: `${rule.description}：「${keyword}」`,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  // Pattern-based checks (phone, ID card, bank card)
  for (const rule of PRIVACY_PATTERNS) {
    const matches = content.match(rule.pattern);
    if (matches) {
      for (const match of matches) {
        const index = content.indexOf(match);
        const start = Math.max(0, index - 10);
        const end = Math.min(content.length, index + match.length + 10);
        const location = content.slice(start, end);

        issues.push({
          type: rule.type,
          severity: "warning",
          location: `...${location}...`,
          description: rule.description,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  return {
    issues,
    isClean: issues.length === 0,
  };
}

/**
 * Retrieve compliance check history for the organization.
 */
export async function getComplianceHistory(orgId: string, limit = 20) {
  const rows = await db
    .select()
    .from(complianceChecks)
    .where(eq(complianceChecks.organizationId, orgId))
    .orderBy(desc(complianceChecks.checkedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    contentId: r.contentId,
    contentType: r.contentType,
    content:
      r.content.length > 100 ? r.content.slice(0, 100) + "..." : r.content,
    issues:
      (r.issues as ComplianceIssue[]) || [],
    isClean: r.isClean ?? true,
    checkedAt: r.checkedAt.toISOString(),
  }));
}

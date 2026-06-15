/**
 * 工作流模板 → mission 用户指令的文案生成(纯函数)。
 *
 * 从 `app/actions/workflow-launch.ts` 提取:cowork 场景启动需要把同一段
 * 指令文案作为会话里的用户消息落库,server action 文件的导出都会被包装成
 * action,纯函数必须住在独立 lib 模块里供两边复用。
 *
 * 渲染产物直接作为 mission.userInstruction 与 cowork 用户消息展示,必须是
 * "人话":select/multiselect 渲染选项的中文 label 而非 value;可选字段为空
 * 时清理周边句式碎片(不残留「聚焦 。」这类破碎短句)。
 */

import { normalizeFieldOption, type InputFieldDef } from "@/lib/types";

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;
/** 子句切分符:中英文逗号 / 分号 / 句号 / 叹问号 + 换行 */
const CLAUSE_SPLIT_RE = /([,,;;。.!?!?\n])/;
/** 句终符:句末残句被移除时,前一子句的逗号类分隔符升级为它,避免以逗号收尾 */
const TERMINAL_SEPS = new Set(["。", ".", "!", "?", "!", "?"]);
const UPGRADABLE_SEPS = new Set([",", ",", ";", ";"]);

// CJK 符号/标点、汉字、兼容表意字、全角形式(含全角空格/标点);日文假名等区段一并覆盖
const isCjkChar = (ch: string) => /[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(ch);

/**
 * 单个参数值 → 用户可读文案。返回 "" 表示「空」,参与残句清理。
 * - 带 options 的字段(select/multiselect):value → 选项 label
 * - 数组:逐项转换后顿号连接(空数组视为空)
 * - 布尔(toggle):是 / 否
 * - daterange:`start ~ end`
 * - 其他对象:JSON 序列化兜底
 */
function displayValue(v: unknown, field?: InputFieldDef): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) {
    return v
      .map((item) => displayValue(item, field))
      .filter((s) => s.length > 0)
      .join("、");
  }
  if (typeof v === "boolean") return v ? "是" : "否";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.start === "string" && typeof o.end === "string") {
      return `${o.start} ~ ${o.end}`;
    }
    return JSON.stringify(v);
  }
  const s = String(v);
  if (s.trim().length === 0) return "";
  if (field?.options) {
    const hit = field.options
      .map(normalizeFieldOption)
      .find((o) => o.value === s);
    if (hit) return hit.label;
  }
  return s;
}

/**
 * 子句内替换占位符。空值连同两侧空格一起塌缩:邻接字符是 CJK 时不留空格
 * (中文无词间空格),西文单词之间原本两侧都有空格时保留一个。
 */
function substituteClause(
  text: string,
  resolve: (key: string) => string,
): string {
  return text.replace(
    /( ?)\{\{(\w+)\}\}( ?)/g,
    (match, lead: string, key: string, trail: string, offset: number, str: string) => {
      const v = resolve(key);
      if (v !== "") return lead + v + trail;
      const prevCh = offset > 0 ? str[offset - 1]! : "";
      const nextCh = str[offset + match.length] ?? "";
      const isWordChar = (ch: string) =>
        ch !== "" && ch !== " " && !isCjkChar(ch);
      return lead && trail && isWordChar(prevCh) && isWordChar(nextCh)
        ? " "
        : "";
    },
  );
}

/**
 * Replace `{{key}}` placeholders in a prompt template with values from `params`.
 *
 * 传入 `fields` 后,select/multiselect 字段按 options 的 value→label 映射渲染。
 * 空值(undefined / null / 空串 / 空数组)做残句清理:某个子句(逗号、句号等
 * 切分)内的占位符**全部**为空时整句移除——因此模板里的可选参数应单独成
 * 短句(如「,聚焦 {{section_scope}}」),不要与必填参数混在同一子句。
 */
export function renderTemplate(
  tpl: string,
  params: Record<string, unknown>,
  fields?: InputFieldDef[] | null,
): string {
  const fieldByName = new Map((fields ?? []).map((f) => [f.name, f]));
  const cache = new Map<string, string>();
  const resolve = (key: string): string => {
    let v = cache.get(key);
    if (v === undefined) {
      v = displayValue(params[key], fieldByName.get(key));
      cache.set(key, v);
    }
    return v;
  };

  // split 带捕获组 → parts 为 [text, sep, text, sep, ..., text] 交替序列
  const parts = tpl.split(CLAUSE_SPLIT_RE);
  const kept: Array<{ text: string; sep: string }> = [];
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i] ?? "";
    const sep = parts[i + 1] ?? "";
    const keys = [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]);
    const drop = keys.length > 0 && keys.every((k) => resolve(k) === "");
    if (!drop) {
      kept.push({ text: substituteClause(text, resolve), sep });
      continue;
    }
    const prev = kept[kept.length - 1];
    if (TERMINAL_SEPS.has(sep) && prev && UPGRADABLE_SEPS.has(prev.sep)) {
      prev.sep = sep;
    }
  }

  return kept
    .map((c) => c.text + c.sep)
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Build a natural-language user instruction for the mission from the template
 * definition + user-provided params.
 *
 * Priority:
 *   1. If `promptTemplate` is present and renders to non-empty, use rendered result.
 *   2. Otherwise fall back to a human-readable "启动场景 + 参数列表" dump —
 *      同样应用字段 label 与选项 label,跳过空值参数。
 */
export function buildUserInstruction(
  templateName: string,
  cleaned: Record<string, unknown>,
  promptTemplate: string | null,
  inputFields?: InputFieldDef[] | null,
): string {
  if (promptTemplate) {
    const rendered = renderTemplate(promptTemplate, cleaned, inputFields);
    if (rendered.trim().length > 0) return rendered;
  }
  const fieldByName = new Map((inputFields ?? []).map((f) => [f.name, f]));
  const paramLines = Object.entries(cleaned)
    .map(([k, v]) => {
      const display = displayValue(v, fieldByName.get(k));
      if (display.length === 0) return null;
      return `- ${fieldByName.get(k)?.label ?? k}: ${display}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
  if (paramLines.length === 0) {
    return `启动场景：${templateName}`;
  }
  return `启动场景：${templateName}\n参数：\n${paramLines}`;
}

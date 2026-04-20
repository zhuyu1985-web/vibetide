import type { InputFieldDef } from "@/lib/types";
import { normalizeFieldOption } from "@/lib/types";

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  cleaned: Record<string, unknown>;
}

/**
 * 对 InputFieldDef[] 字段定义 + 用户输入做 server 端校验。
 *
 * 覆盖 9 种字段类型：text / textarea / url / number / toggle / select /
 * multiselect / date / daterange。
 *
 * - required 字段为空返回「必填」
 * - 非必填字段为空直接跳过（不进 cleaned）
 * - select/multiselect 的 options 兼容 string[] 与 {value,label}[] 联合数组
 * - number 接受数字或数字字符串，统一归一化为 number
 */
export function validateInputs(
  fields: InputFieldDef[],
  values: Record<string, unknown>,
): ValidationResult {
  const errors: Record<string, string> = {};
  const cleaned: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = values[field.name];
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.length === 0) ||
      (Array.isArray(raw) && raw.length === 0);

    if (isEmpty) {
      if (field.required) errors[field.name] = "必填";
      continue;
    }

    switch (field.type) {
      case "text":
      case "textarea":
      case "url": {
        if (typeof raw !== "string") {
          errors[field.name] = "必须是文本";
          break;
        }
        const v = field.validation;
        if (v?.minLength !== undefined && raw.length < v.minLength) {
          errors[field.name] = `至少 ${v.minLength} 字`;
          break;
        }
        if (v?.maxLength !== undefined && raw.length > v.maxLength) {
          errors[field.name] = `最多 ${v.maxLength} 字`;
          break;
        }
        if (v?.pattern && !new RegExp(v.pattern).test(raw)) {
          errors[field.name] = "格式不符";
          break;
        }
        if (field.type === "url") {
          try {
            new URL(raw);
          } catch {
            errors[field.name] = "URL 格式无效";
            break;
          }
        }
        cleaned[field.name] = raw;
        break;
      }
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isNaN(n)) {
          errors[field.name] = "必须是数字";
          break;
        }
        const v = field.validation;
        if (v?.min !== undefined && n < v.min) {
          errors[field.name] = `最小 ${v.min}`;
          break;
        }
        if (v?.max !== undefined && n > v.max) {
          errors[field.name] = `最大 ${v.max}`;
          break;
        }
        cleaned[field.name] = n;
        break;
      }
      case "toggle": {
        cleaned[field.name] = Boolean(raw);
        break;
      }
      case "select": {
        const valid =
          field.options?.some((o) => normalizeFieldOption(o).value === raw) ?? false;
        if (!valid) {
          errors[field.name] = "选项无效";
          break;
        }
        cleaned[field.name] = raw;
        break;
      }
      case "multiselect": {
        if (!Array.isArray(raw)) {
          errors[field.name] = "必须是数组";
          break;
        }
        const allValid = raw.every(
          (x) => field.options?.some((o) => normalizeFieldOption(o).value === x) ?? false,
        );
        if (!allValid) {
          errors[field.name] = "包含无效选项";
          break;
        }
        cleaned[field.name] = raw;
        break;
      }
      case "date": {
        if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
          errors[field.name] = "日期格式无效";
          break;
        }
        cleaned[field.name] = raw;
        break;
      }
      case "daterange": {
        if (
          typeof raw !== "object" ||
          raw === null ||
          !("start" in raw) ||
          !("end" in raw)
        ) {
          errors[field.name] = "日期范围格式无效";
          break;
        }
        cleaned[field.name] = raw;
        break;
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}

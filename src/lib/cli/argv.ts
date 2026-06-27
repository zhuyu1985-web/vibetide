/**
 * argv 安全引擎 — CLI 安全模型的核心
 *
 * 负责将 LLM 提供的结构化参数转换为安全的 argv 数组，确保：
 * 1. 参数通过 schema 校验（类型、范围、枚举值、正则、必填、未知字段）
 * 2. resolveArgv 输出的每个 {param}/{output} token 严格映射为 **单个** argv 元素
 *    — 永不分割、永不 shell 内插、永不字符串拼接，从根本上消除注入风险
 */

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

/** 单个字段的 schema 规范 */
export interface FieldSpec {
  /** 字段类型 */
  type: "string" | "number" | "enum" | "asset";
  /** 是否必填，默认 false */
  required?: boolean;
  /** type:"enum" 时的合法值列表 */
  values?: string[];
  /** type:"number" 时的最小值（含） */
  min?: number;
  /** type:"number" 时的最大值（含） */
  max?: number;
  /**
   * type:"string" 时的正则约束（不含定界符的模式字符串）。
   * 内部使用 `new RegExp(regex)` 构造，调用方应确保已锚定（如 `^...$`）。
   */
  regex?: string;
}

/** 工具参数 schema：字段名 → 字段规范 */
export type ArgsSchema = Record<string, FieldSpec>;

/** argv 模板 token：字面量字符串、param 引用、或 output 引用 */
export type ArgvToken =
  | string
  | { param: string }
  | { output: string };

/** argv 模板数组 */
export type ArgvTemplate = ArgvToken[];

/** 经过校验的参数映射（值类型可为 string | number） */
export type ValidatedParams = Record<string, string | number>;

// ─── validateParams ───────────────────────────────────────────────────────────

/**
 * 根据 argsSchema 校验并规范化 LLM 提供的 params。
 *
 * 拒绝条件（任意一条满足即抛出 Error）：
 * - 存在 schema 中未声明的字段（防止 LLM 注入额外参数）
 * - required 字段缺失
 * - type:"enum" 值不在 values 列表中
 * - type:"number" 值为非有限数字、或超出 min/max 范围
 * - type:"string" 值不匹配 regex（若声明了 regex）
 * - type:"asset" 值为空字符串
 *
 * @param argsSchema 注册时声明的字段规范
 * @param params     LLM 提供的原始参数对象
 * @returns 经过校验的参数（原样返回合法值）
 * @throws {Error} 任何校验失败
 */
export function validateParams(
  argsSchema: ArgsSchema,
  params: Record<string, unknown>
): ValidatedParams {
  // 1. 拒绝未知字段——防止 LLM 注入 schema 以外的参数
  for (const key of Object.keys(params)) {
    if (!(key in argsSchema)) {
      throw new Error(`未知参数 "${key}"，不在 schema 中声明`);
    }
  }

  const validated: ValidatedParams = {};

  for (const [key, spec] of Object.entries(argsSchema)) {
    const raw = params[key];
    const present = key in params && raw !== undefined && raw !== null;

    // 2. 检查必填
    if (spec.required && !present) {
      throw new Error(`必填参数 "${key}" 缺失`);
    }

    // 可选且未提供，跳过
    if (!present) continue;

    // 3. 按类型校验
    switch (spec.type) {
      case "asset": {
        if (typeof raw !== "string" || raw.length === 0) {
          throw new Error(
            `参数 "${key}" (asset) 必须是非空字符串，实际为: ${JSON.stringify(raw)}`
          );
        }
        validated[key] = raw;
        break;
      }

      case "enum": {
        if (typeof raw !== "string") {
          throw new Error(
            `参数 "${key}" (enum) 必须是字符串，实际为: ${JSON.stringify(raw)}`
          );
        }
        const allowed = spec.values ?? [];
        if (!allowed.includes(raw)) {
          throw new Error(
            `参数 "${key}" 的值 "${raw}" 不在允许列表 [${allowed.join(", ")}] 中`
          );
        }
        validated[key] = raw;
        break;
      }

      case "number": {
        const num = typeof raw === "number" ? raw : Number(raw);
        if (typeof raw !== "number" || !Number.isFinite(num)) {
          throw new Error(
            `参数 "${key}" (number) 必须是有限数字，实际为: ${JSON.stringify(raw)}`
          );
        }
        if (spec.min !== undefined && num < spec.min) {
          throw new Error(
            `参数 "${key}" 的值 ${num} 低于最小值 ${spec.min}`
          );
        }
        if (spec.max !== undefined && num > spec.max) {
          throw new Error(
            `参数 "${key}" 的值 ${num} 高于最大值 ${spec.max}`
          );
        }
        validated[key] = num;
        break;
      }

      case "string": {
        if (typeof raw !== "string") {
          throw new Error(
            `参数 "${key}" (string) 必须是字符串，实际为: ${JSON.stringify(raw)}`
          );
        }
        if (spec.regex !== undefined) {
          const pattern = new RegExp(spec.regex);
          if (!pattern.test(raw)) {
            throw new Error(
              `参数 "${key}" 的值 "${raw}" 不匹配正则 /${spec.regex}/`
            );
          }
        }
        validated[key] = raw;
        break;
      }

      default: {
        // TypeScript exhaustive check — 运行时防御未知 type
        const _exhaustive: never = spec.type;
        throw new Error(`未知字段类型: ${String(_exhaustive)}`);
      }
    }
  }

  return validated;
}

// ─── resolveArgv ─────────────────────────────────────────────────────────────

/**
 * 将 argv 模板展开为具体的 argv 数组（string[]）。
 *
 * **安全不变量：**
 * - 每个 `{param}` token 被替换为 **恰好一个** argv 元素（String 强制转型）
 * - 每个 `{output}` token 被替换为 **恰好一个** argv 元素（outputPath）
 * - 字面量 string token 原样输出
 * - 任何参数值都 **不会** 被分割、不会参与 shell 内插、不会与其他字符串拼接
 *
 * 下游使用 `spawn(cmd, argv, { shell: false })` 时，argv 中每个元素都是
 * 操作系统级的独立参数，`"a; rm -rf /"` 等注入内容在 shell:false 模式下
 * 永远是一个无害的字面量参数。
 *
 * @param argvTemplate   注册时声明的参数模板
 * @param validatedParams 已经过 validateParams 校验的参数（可含已解析的 asset 路径）
 * @param outputPath     输出文件路径（替换 {output} token）
 * @returns 展开后的 argv 数组
 * @throws {Error} 模板引用了 validatedParams 中不存在的 param 名
 */
export function resolveArgv(
  argvTemplate: ArgvTemplate,
  validatedParams: ValidatedParams,
  outputPath: string
): string[] {
  return argvTemplate.map((token): string => {
    // 字面量 token
    if (typeof token === "string") {
      return token;
    }

    // {output} token — 替换为 outputPath（单个元素）
    if ("output" in token) {
      return outputPath;
    }

    // {param} token — 替换为校验后的参数值（单个元素，String 强制转型）
    if ("param" in token) {
      const name = token.param;
      if (!(name in validatedParams)) {
        throw new Error(
          `argv 模板引用了未知参数 "${name}"，validatedParams 中无此键`
        );
      }
      // String() 转型确保数字也能正确输出，且绝不分割
      return String(validatedParams[name]);
    }

    // TypeScript 穷举检查
    const _exhaustive: never = token;
    throw new Error(`未知 ArgvToken: ${JSON.stringify(_exhaustive)}`);
  });
}

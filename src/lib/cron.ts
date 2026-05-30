/**
 * Cron 表达式校验 —— 供 server actions / DAL 在写入 scheduled_jobs 前调用。
 *
 * 校验内容:
 *   1. 表达式语法合法(cron-parser 不抛)
 *   2. 时区合法(cron-parser 不抛)
 *   3. 相邻两次执行间隔 ≥ MIN_INTERVAL_SECONDS(防止运营误填高频 cron
 *      导致 mission 启动风暴 + token 配额耗尽)
 *
 * 注:平台级 cron(scheduled_jobs.kind='platform')允许 < 60s,但 V1 不暴露 UI,
 * 通过 admin 直接改 DB 写入;本校验只用于 workflow_template kind。
 */
import { CronExpressionParser } from "cron-parser";

/** 周期下限 60 秒 —— D4 决策见 design.md */
export const MIN_CRON_INTERVAL_SECONDS = 60;

export type CronValidationResult =
  | { ok: true; nextRuns: Date[] }
  | { ok: false; error: string };

/**
 * 校验 cron + timezone,返回 {ok, nextRuns?} 或 {ok:false, error}。
 * - error 信息为中文,可直接回显到 UI 字段错误
 * - nextRuns 返回未来 3 次执行时间,UI 可用于"下一次执行"预览
 */
export function validateCronExpression(
  expression: string,
  timezone: string,
): CronValidationResult {
  if (!expression || expression.trim().length === 0) {
    return { ok: false, error: "cron 表达式不能为空" };
  }

  let interval;
  try {
    interval = CronExpressionParser.parse(expression.trim(), {
      tz: timezone,
      currentDate: new Date(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `cron 表达式格式错误:${msg}` };
  }

  // 计算未来 3 次执行
  let first: Date;
  let second: Date;
  let third: Date;
  try {
    first = interval.next().toDate();
    second = interval.next().toDate();
    third = interval.next().toDate();
  } catch {
    return { ok: false, error: "cron 表达式无法计算下次执行时间" };
  }

  const intervalSeconds = (second.getTime() - first.getTime()) / 1000;
  if (intervalSeconds < MIN_CRON_INTERVAL_SECONDS) {
    return {
      ok: false,
      error: `执行周期不能小于 ${MIN_CRON_INTERVAL_SECONDS} 秒(当前约 ${Math.round(intervalSeconds)} 秒)`,
    };
  }

  return { ok: true, nextRuns: [first, second, third] };
}

/**
 * 快速判断 cron 是否合法 —— 用于不需要 nextRuns 的简单 boolean 场景。
 */
export function isCronExpressionValid(expression: string, timezone: string): boolean {
  return validateCronExpression(expression, timezone).ok;
}

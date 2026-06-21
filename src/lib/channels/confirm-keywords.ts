const CONFIRM = new Set(["开始", "确认", "ok", "yes", "好", "可以", "执行"]);
const CANCEL = new Set(["取消", "cancel", "算了", "不用了", "停"]);

const norm = (t: string) => t.trim().toLowerCase();

export function isConfirm(text: string): boolean {
  return CONFIRM.has(norm(text));
}

export function isCancel(text: string): boolean {
  return CANCEL.has(norm(text));
}

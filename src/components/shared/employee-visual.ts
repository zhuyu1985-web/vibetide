import {
  EMPLOYEE_META,
  CRAFT_META,
  CRAFT_AVATAR_SOURCE,
  type EmployeeId,
  type CraftType,
} from "@/lib/constants";
import { User, type LucideIcon } from "lucide-react";
import { EMPLOYEE_AVATAR_MAP } from "./employee-svg-avatars";

export interface EmployeeVisual {
  /** 解析后的头像来源 slug:工种实例 → 被取代旧员工 slug;否则原 slug。 */
  avatarSlug: string;
  /** 富 SVG 头像组件(无则为 undefined,用 Icon 兜底)。 */
  SvgAvatar: (typeof EMPLOYEE_AVATAR_MAP)[EmployeeId] | undefined;
  Icon: LucideIcon;
  color: string;
  bgColor: string;
  name?: string;
  nickname?: string;
  description?: string;
}

/**
 * 四层重构:员工/工种视觉的【单一真相源】。各处不要再手搓
 * `EMPLOYEE_META[id]` —— 那样工种实例(slug=director/reporter…)查不到就没头像。
 *
 * 解析规则:
 *  - 工种实例(slug ∈ CRAFT_META):经 CRAFT_AVATAR_SOURCE 继承被取代旧员工的 SVG 头像
 *    与配色;无 source 的工种(anchor)回退 CRAFT_META 自带图标。
 *  - 旧员工 slug / 自定义 slug:原样走 EMPLOYEE_META + EMPLOYEE_AVATAR_MAP,行为不变。
 */
export function resolveEmployeeVisual(employeeId: string): EmployeeVisual {
  const craftMeta =
    employeeId in CRAFT_META ? CRAFT_META[employeeId as CraftType] : undefined;
  const avatarSlug = craftMeta
    ? CRAFT_AVATAR_SOURCE[employeeId as CraftType] ?? employeeId
    : employeeId;
  const oldMeta = EMPLOYEE_META[avatarSlug as EmployeeId];
  return {
    avatarSlug,
    // 视觉(头像/图标/配色)来自头像来源(工种实例 → 被取代旧员工的 SVG)。
    SvgAvatar: EMPLOYEE_AVATAR_MAP[avatarSlug as EmployeeId],
    Icon: oldMeta?.icon ?? craftMeta?.icon ?? User,
    color: oldMeta?.color ?? craftMeta?.color ?? "#6b7280",
    bgColor: oldMeta?.bgColor ?? craftMeta?.bgColor ?? "rgba(107,114,128,0.12)",
    // 身份(名字/职责)用工种自己的(后期剪辑/审核…),不要被头像来源旧员工的名字
    // (视频制片人/质量审核官…)覆盖;非工种 slug 退回 EMPLOYEE_META,再退回调用方 employee.*。
    name: craftMeta?.name ?? oldMeta?.name,
    nickname: craftMeta?.name ?? oldMeta?.nickname,
    description: craftMeta?.description ?? oldMeta?.description,
  };
}

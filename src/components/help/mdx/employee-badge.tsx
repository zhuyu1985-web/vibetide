import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { cn } from "@/lib/utils";

interface EmployeeBadgeProps {
  id: EmployeeId | string;
  className?: string;
}

/**
 * 文档内嵌的 AI 员工小卡:头像 + 名字 + 1 行职责。
 * 数据来自 EMPLOYEE_META;未知 id 直接返回 null,不让文档构建挂掉。
 */
export function EmployeeBadge({ id, className }: EmployeeBadgeProps) {
  const meta = EMPLOYEE_META[id as EmployeeId];
  if (!meta) return null;

  return (
    <span
      className={cn(
        "my-2 inline-flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2 align-middle no-underline",
        className,
      )}
    >
      <EmployeeAvatar employeeId={meta.id} size="sm" animated={false} />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-foreground">{meta.name}</span>
        <span className="text-xs text-muted-foreground">{meta.description}</span>
      </span>
    </span>
  );
}

"use client";

import { usePermissions } from "@/components/providers/permission-provider";

/**
 * Conditionally renders children based on permissions.
 *
 * <PermissionGate permission="content:write">
 *   <Button>新建稿件</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  permissions: requiredAny,
  fallback = null,
  children,
}: {
  /** Single permission to check */
  permission?: string;
  /** Any-of: show if user has at least one */
  permissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { permissions, isSuperAdmin } = usePermissions();

  if (isSuperAdmin) return <>{children}</>;

  if (permission && permissions.includes(permission)) return <>{children}</>;
  if (requiredAny?.some((p) => permissions.includes(p))) return <>{children}</>;

  return <>{fallback}</>;
}

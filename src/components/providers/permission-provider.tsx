"use client";

import { createContext, useContext, useMemo } from "react";

interface PermissionContextValue {
  permissions: string[];
  isSuperAdmin: boolean;
}

const PermissionContext = createContext<PermissionContextValue>({
  permissions: [],
  isSuperAdmin: false,
});

export function PermissionProvider({
  permissions,
  isSuperAdmin,
  children,
}: {
  permissions: string[];
  isSuperAdmin: boolean;
  children: React.ReactNode;
}) {
  // 用 useMemo 稳定 value 引用,避免 Provider 每次 render 都让所有 usePermissions() 消费方重渲。
  // permissions.join(",") 作为依赖追踪数组内容变化(而非引用变化)。
  const value = useMemo(
    () => ({ permissions, isSuperAdmin }),
    [permissions.join(","), isSuperAdmin],
  );
  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

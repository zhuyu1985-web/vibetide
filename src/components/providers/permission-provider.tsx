"use client";

import { createContext, useContext } from "react";

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
  return (
    <PermissionContext.Provider value={{ permissions, isSuperAdmin }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

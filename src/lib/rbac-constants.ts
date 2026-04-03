// ---------------------------------------------------------------------------
// Permission constants — safe for client components (no DB imports)
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  SYSTEM_MANAGE_ORGS: "system:manage_orgs",
  SYSTEM_MANAGE_USERS: "system:manage_users",
  SYSTEM_MANAGE_ROLES: "system:manage_roles",
  CONTENT_READ: "content:read",
  CONTENT_WRITE: "content:write",
  CONTENT_MANAGE: "content:manage",
  CONTENT_PUBLISH: "content:publish",
  ANALYTICS_READ: "analytics:read",
  ANALYTICS_MANAGE: "analytics:manage",
  AI_USE: "ai:use",
  AI_MANAGE: "ai:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const DEFAULT_ROLES = {
  admin: {
    name: "管理员",
    slug: "admin",
    description: "拥有组织内全部权限",
    permissions: ALL_PERMISSIONS,
  },
  editor: {
    name: "编辑",
    slug: "editor",
    description: "可以创建和编辑内容",
    permissions: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_WRITE,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.AI_USE,
    ],
  },
  viewer: {
    name: "访客",
    slug: "viewer",
    description: "只读访问",
    permissions: [PERMISSIONS.CONTENT_READ, PERMISSIONS.ANALYTICS_READ],
  },
} as const;

export const PERMISSION_GROUPS = [
  {
    label: "系统管理",
    permissions: [
      { key: PERMISSIONS.SYSTEM_MANAGE_ORGS, label: "管理组织" },
      { key: PERMISSIONS.SYSTEM_MANAGE_USERS, label: "管理用户" },
      { key: PERMISSIONS.SYSTEM_MANAGE_ROLES, label: "管理角色" },
    ],
  },
  {
    label: "内容管理",
    permissions: [
      { key: PERMISSIONS.CONTENT_READ, label: "查看内容" },
      { key: PERMISSIONS.CONTENT_WRITE, label: "创建/编辑内容" },
      { key: PERMISSIONS.CONTENT_MANAGE, label: "管理栏目" },
      { key: PERMISSIONS.CONTENT_PUBLISH, label: "发布内容" },
    ],
  },
  {
    label: "数据分析",
    permissions: [
      { key: PERMISSIONS.ANALYTICS_READ, label: "查看分析" },
      { key: PERMISSIONS.ANALYTICS_MANAGE, label: "配置分析" },
    ],
  },
  {
    label: "AI 能力",
    permissions: [
      { key: PERMISSIONS.AI_USE, label: "使用 AI 员工" },
      { key: PERMISSIONS.AI_MANAGE, label: "配置 AI 员工" },
    ],
  },
];

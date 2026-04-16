// ---------------------------------------------------------------------------
// Permission constants — safe for client components (no DB imports)
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  // System administration
  SYSTEM_MANAGE_ORGS: "system:manage_orgs",
  SYSTEM_MANAGE_USERS: "system:manage_users",
  SYSTEM_MANAGE_ROLES: "system:manage_roles",
  // Content
  CONTENT_READ: "content:read",
  CONTENT_WRITE: "content:write",
  CONTENT_MANAGE: "content:manage",
  CONTENT_PUBLISH: "content:publish",
  // Analytics
  ANALYTICS_READ: "analytics:read",
  ANALYTICS_MANAGE: "analytics:manage",
  // AI
  AI_USE: "ai:use",
  AI_MANAGE: "ai:manage",
  // Menu visibility — workspace
  MENU_MISSIONS: "menu:missions",
  MENU_EMPLOYEES: "menu:employees",
  MENU_CHAT: "menu:chat",
  MENU_SKILLS: "menu:skills",
  MENU_CHANNEL_ADVISOR: "menu:channel_advisor",
  // Menu visibility — content management
  MENU_MEDIA_ASSETS: "menu:media_assets",
  MENU_ARTICLES: "menu:articles",
  MENU_CATEGORIES: "menu:categories",
  // Menu visibility — asset intelligence
  MENU_ASSET_INTELLIGENCE: "menu:asset_intelligence",
  MENU_CHANNEL_KNOWLEDGE: "menu:channel_knowledge",
  MENU_ASSET_REVIVE: "menu:asset_revive",
  // Menu visibility — creator center
  MENU_INSPIRATION: "menu:inspiration",
  MENU_BENCHMARKING: "menu:benchmarking",
  MENU_SUPER_CREATION: "menu:super_creation",
  MENU_PREMIUM_CONTENT: "menu:premium_content",
  MENU_VIDEO_BATCH: "menu:video_batch",
  MENU_EVENT_AUTO: "menu:event_auto",
  MENU_BATCH_REVIEW: "menu:batch_review",
  MENU_PRODUCTION_TEMPLATES: "menu:production_templates",
  // Menu visibility — omnichannel
  MENU_PUBLISHING: "menu:publishing",
  MENU_ANALYTICS: "menu:analytics",
  MENU_LEADERBOARD: "menu:leaderboard",
  MENU_CONTENT_EXCELLENCE: "menu:content_excellence",
  MENU_CASE_LIBRARY: "menu:case_library",
  // Menu visibility — news research
  MENU_RESEARCH: "menu:research",
  // News research module
  RESEARCH_TASK_CREATE: "research:task_create",
  RESEARCH_TASK_VIEW_OWN: "research:task_view_own",
  RESEARCH_TASK_VIEW_ORG: "research:task_view_org",
  RESEARCH_TASK_EXPORT: "research:task_export",
  RESEARCH_MEDIA_OUTLET_MANAGE: "research:media_outlet_manage",
  RESEARCH_TOPIC_MANAGE: "research:topic_manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// All menu permissions for convenience
export const ALL_MENU_PERMISSIONS = Object.entries(PERMISSIONS)
  .filter(([k]) => k.startsWith("MENU_"))
  .map(([, v]) => v);

// Map href → permission for sidebar filtering
export const MENU_PERMISSION_MAP: Record<string, string | undefined> = {
  // Primary nav (new simplified sidebar)
  "/home": undefined, // always visible
  "/ai-employees": PERMISSIONS.MENU_EMPLOYEES,
  "/workflows": PERMISSIONS.MENU_MISSIONS, // reuse missions permission
  "/missions": PERMISSIONS.MENU_MISSIONS,
  "/creation": undefined, // tab-level control (future)
  "/content": undefined, // tab-level control (future)
  "/analytics": undefined, // tab-level control (future)
  // More panel items
  "/channel-advisor": PERMISSIONS.MENU_CHANNEL_ADVISOR,
  "/event-auto": PERMISSIONS.MENU_EVENT_AUTO,
  "/batch-review": PERMISSIONS.MENU_BATCH_REVIEW,
  "/case-library": PERMISSIONS.MENU_CASE_LIBRARY,
  // Legacy routes (kept for backward compatibility)
  "/employee-marketplace": PERMISSIONS.MENU_EMPLOYEES,
  "/chat": PERMISSIONS.MENU_CHAT,
  "/skills": PERMISSIONS.MENU_SKILLS,
  "/media-assets": PERMISSIONS.MENU_MEDIA_ASSETS,
  "/articles": PERMISSIONS.MENU_ARTICLES,
  "/categories": PERMISSIONS.MENU_CATEGORIES,
  "/asset-intelligence": PERMISSIONS.MENU_ASSET_INTELLIGENCE,
  "/channel-knowledge": PERMISSIONS.MENU_CHANNEL_KNOWLEDGE,
  "/asset-revive": PERMISSIONS.MENU_ASSET_REVIVE,
  "/inspiration": PERMISSIONS.MENU_INSPIRATION,
  "/benchmarking": PERMISSIONS.MENU_BENCHMARKING,
  "/super-creation": PERMISSIONS.MENU_SUPER_CREATION,
  "/premium-content": PERMISSIONS.MENU_PREMIUM_CONTENT,
  "/video-batch": PERMISSIONS.MENU_VIDEO_BATCH,
  "/production-templates": PERMISSIONS.MENU_PRODUCTION_TEMPLATES,
  "/publishing": PERMISSIONS.MENU_PUBLISHING,
  "/leaderboard": PERMISSIONS.MENU_LEADERBOARD,
  "/content-excellence": PERMISSIONS.MENU_CONTENT_EXCELLENCE,
  // News research
  "/research": PERMISSIONS.MENU_RESEARCH,
  "/research/admin/tasks": PERMISSIONS.RESEARCH_TASK_CREATE,
  "/research/admin/media-outlets": PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE,
  "/research/admin/topics": PERMISSIONS.RESEARCH_TOPIC_MANAGE,
};

// Tab-level permission map for pages with tabbed sub-sections
export const TAB_PERMISSION_MAP: Record<string, Record<string, string>> = {
  "/creation": {
    inspiration: PERMISSIONS.MENU_INSPIRATION,
    benchmarking: PERMISSIONS.MENU_BENCHMARKING,
    "super-creation": PERMISSIONS.MENU_SUPER_CREATION,
    "premium-content": PERMISSIONS.MENU_PREMIUM_CONTENT,
    "video-batch": PERMISSIONS.MENU_VIDEO_BATCH,
    "production-templates": PERMISSIONS.MENU_PRODUCTION_TEMPLATES,
  },
  "/content": {
    assets: PERMISSIONS.MENU_MEDIA_ASSETS,
    articles: PERMISSIONS.MENU_ARTICLES,
    categories: PERMISSIONS.MENU_CATEGORIES,
    intelligence: PERMISSIONS.MENU_ASSET_INTELLIGENCE,
    knowledge: PERMISSIONS.MENU_CHANNEL_KNOWLEDGE,
    revive: PERMISSIONS.MENU_ASSET_REVIVE,
  },
  "/analytics": {
    publishing: PERMISSIONS.MENU_PUBLISHING,
    analytics: PERMISSIONS.MENU_ANALYTICS,
    leaderboard: PERMISSIONS.MENU_LEADERBOARD,
    excellence: PERMISSIONS.MENU_CONTENT_EXCELLENCE,
  },
};

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
      // News research (editor role can operate the module)
      PERMISSIONS.RESEARCH_TASK_CREATE,
      PERMISSIONS.RESEARCH_TASK_VIEW_OWN,
      PERMISSIONS.RESEARCH_TASK_EXPORT,
      // Editor can see most menus
      ...ALL_MENU_PERMISSIONS,
    ],
  },
  viewer: {
    name: "访客",
    slug: "viewer",
    description: "只读访问",
    permissions: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.ANALYTICS_READ,
      // Viewer sees limited menus
      PERMISSIONS.MENU_MISSIONS,
      PERMISSIONS.MENU_MEDIA_ASSETS,
      PERMISSIONS.MENU_ARTICLES,
      PERMISSIONS.MENU_ANALYTICS,
    ],
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
  {
    label: "菜单权限 — 工作空间",
    permissions: [
      { key: PERMISSIONS.MENU_MISSIONS, label: "任务中心" },
      { key: PERMISSIONS.MENU_EMPLOYEES, label: "AI数字员工" },
      { key: PERMISSIONS.MENU_CHAT, label: "对话中心" },
      { key: PERMISSIONS.MENU_SKILLS, label: "技能管理" },
      { key: PERMISSIONS.MENU_CHANNEL_ADVISOR, label: "频道顾问" },
    ],
  },
  {
    label: "菜单权限 — 内容管理",
    permissions: [
      { key: PERMISSIONS.MENU_MEDIA_ASSETS, label: "媒资管理" },
      { key: PERMISSIONS.MENU_ARTICLES, label: "稿件管理" },
      { key: PERMISSIONS.MENU_CATEGORIES, label: "栏目管理" },
    ],
  },
  {
    label: "菜单权限 — 智能媒资",
    permissions: [
      { key: PERMISSIONS.MENU_ASSET_INTELLIGENCE, label: "媒资智能理解" },
      { key: PERMISSIONS.MENU_CHANNEL_KNOWLEDGE, label: "频道知识库" },
      { key: PERMISSIONS.MENU_ASSET_REVIVE, label: "资产盘活中心" },
    ],
  },
  {
    label: "菜单权限 — 创作者中心",
    permissions: [
      { key: PERMISSIONS.MENU_INSPIRATION, label: "热点发现" },
      { key: PERMISSIONS.MENU_BENCHMARKING, label: "同题对标" },
      { key: PERMISSIONS.MENU_SUPER_CREATION, label: "超级创作" },
      { key: PERMISSIONS.MENU_PREMIUM_CONTENT, label: "精品聚合" },
      { key: PERMISSIONS.MENU_VIDEO_BATCH, label: "短视频工厂" },
      { key: PERMISSIONS.MENU_EVENT_AUTO, label: "节赛会展" },
      { key: PERMISSIONS.MENU_BATCH_REVIEW, label: "批量审核" },
      { key: PERMISSIONS.MENU_PRODUCTION_TEMPLATES, label: "生产模板" },
    ],
  },
  {
    label: "菜单权限 — 全渠道传播",
    permissions: [
      { key: PERMISSIONS.MENU_PUBLISHING, label: "全渠道发布" },
      { key: PERMISSIONS.MENU_ANALYTICS, label: "数据分析" },
      { key: PERMISSIONS.MENU_LEADERBOARD, label: "效果激励" },
      { key: PERMISSIONS.MENU_CONTENT_EXCELLENCE, label: "精品率提升" },
      { key: PERMISSIONS.MENU_CASE_LIBRARY, label: "优秀案例库" },
    ],
  },
  {
    label: "研究",
    permissions: [
      { key: PERMISSIONS.MENU_RESEARCH, label: "查看新闻研究模块" },
      { key: PERMISSIONS.RESEARCH_TASK_CREATE, label: "创建研究任务" },
      { key: PERMISSIONS.RESEARCH_TASK_VIEW_OWN, label: "查看自己的研究任务" },
      { key: PERMISSIONS.RESEARCH_TASK_VIEW_ORG, label: "查看组织内所有研究任务" },
      { key: PERMISSIONS.RESEARCH_TASK_EXPORT, label: "导出研究结果" },
      { key: PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE, label: "管理媒体源" },
      { key: PERMISSIONS.RESEARCH_TOPIC_MANAGE, label: "管理主题词库" },
    ],
  },
];

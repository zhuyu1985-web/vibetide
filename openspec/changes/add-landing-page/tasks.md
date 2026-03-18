# Tasks

## Phase 1: Foundation & Shared Components

- [ ] **T01**: 创建动画基础组件 — `floating-orbs.tsx`（浮动光球）、`cursor-glow.tsx`（鼠标跟随光效）、`typewriter-text.tsx`（打字机）、`animated-counter.tsx`（数字计数器）、`tilt-card.tsx`（3D 倾斜卡片）、`shimmer-button.tsx`（光泽按钮）、`pipeline-node.tsx`（流水线节点）
- [ ] **T02**: 创建落地页导航栏 `navbar.tsx` — 毛玻璃背景、锚点链接、sticky 滚动、登录/注册按钮
- [ ] **T03**: 创建 `landing-page.tsx` 主入口组件 — "use client"，组合所有 section

## Phase 2: Page Sections

- [ ] **T04**: 实现 Hero Section — 3 层背景（渐变 + 光球 + 鼠标跟随）、打字机标题、fade-in 副标题、CTA 按钮、滚动箭头
- [ ] **T05**: 实现 AI Team Section — 8 员工卡片网格、stagger 入场、3D 悬停倾斜、呼吸光环、数据从 `EMPLOYEE_META` 读取
- [ ] **T06**: 实现 Capabilities Section — 4 个 zigzag 能力块、视差滚动、连接线逐段点亮
- [ ] **T07**: 实现 Workflow Section — 6 步流水线、滚动触发依次激活、光点流动、完成徽章 + 撒花、底部对比数据条
- [ ] **T08**: 实现 Stats Section — 渐变背景带、4 组数字滚动计数器、符号 pop-in、背景光球
- [ ] **T09**: 实现 Scenarios Section — 3 张场景卡片、员工头像 overlap、悬停展开交互、移动端轮播
- [ ] **T10**: 实现 CTA Section — 弧形分隔、加强渐变背景、标语动画、shimmer 按钮、Footer

## Phase 3: Integration & Polish

- [ ] **T11**: 修改 `src/app/page.tsx` — 未登录渲染 LandingPage，已登录 redirect `/team-hub`
- [ ] **T12**: 响应式适配 — 所有板块的 mobile/tablet 布局、禁用移动端重度动画
- [ ] **T13**: 暗色模式适配 — 验证所有板块在 dark mode 下的视觉效果
- [ ] **T14**: 性能优化 — `will-change` 提示、whileInView 延迟触发、移动端动画降级
- [ ] **T15**: TypeScript 类型检查 + 构建验证 — `npx tsc --noEmit` && `npm run build`

## Dependencies
- T04-T10 依赖 T01（共享动画组件）
- T04 依赖 T02（导航栏）
- T11 依赖 T03 + T04-T10（所有 section 就绪）
- T12-T14 依赖 T11（集成完成后打磨）
- T15 最后执行

## Parallelizable
- T01 和 T02 可并行
- T04-T10 在 T01 完成后可全部并行
- T12、T13、T14 可并行

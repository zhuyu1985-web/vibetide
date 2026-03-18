# Add Landing Page

## Summary
为 Vibetide 平台创建一个炫酷的产品落地页，替换当前根路由的纯重定向逻辑。未登录用户将看到带有重度动画效果的产品展示页面，已登录用户自动跳转到 `/team-hub`。

## Motivation
当前根路由 `/` 仅做重定向，没有产品展示页面。新用户无法了解产品功能和价值主张，缺少将访客转化为注册用户的入口。

## Approach
- 使用纯 CSS + Framer Motion（项目已有依赖）实现所有动效，零新依赖
- 延续现有 Glass UI 毛玻璃渐变设计语言
- 7 个板块：Hero → AI 团队 → 核心能力 → 工作流演示 → 数据统计 → 场景案例 → CTA
- 页面内容全中文
- 复用现有组件（GlassCard、EmployeeAvatar）和设计 token

## Design Document
详细设计见 `docs/plans/2026-03-09-landing-page-design.md`

## Impact
- 修改 `src/app/page.tsx`（根路由逻辑）
- 新增 `src/app/landing/` 目录（所有落地页组件）
- 不影响现有 dashboard、auth 等功能
- 不引入新依赖

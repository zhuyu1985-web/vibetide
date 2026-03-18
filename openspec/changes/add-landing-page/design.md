# Landing Page — Technical Design

## Architecture

### Route Strategy
`src/app/page.tsx` 保持 Server Component，检查 Supabase auth 状态：
- 已登录 → `redirect('/team-hub')`
- 未登录 → 渲染 `<LandingPage />` Client Component

### File Structure
```
src/app/
  page.tsx                          # Server: auth check + 条件渲染
  landing/
    landing-page.tsx                # "use client" 主入口
    sections/
      hero-section.tsx
      team-section.tsx
      capabilities-section.tsx
      workflow-section.tsx
      stats-section.tsx
      scenarios-section.tsx
      cta-section.tsx
    components/
      floating-orbs.tsx             # 浮动光球背景
      cursor-glow.tsx               # 鼠标跟随光效
      typewriter-text.tsx           # 打字机效果
      animated-counter.tsx          # 数字滚动计数器
      tilt-card.tsx                 # 3D 倾斜卡片
      pipeline-node.tsx             # 流水线节点
      shimmer-button.tsx            # 光泽扫过按钮
      navbar.tsx                    # 落地页导航栏
```

### Animation Technology Map
| Effect | Implementation |
|--------|---------------|
| Floating orbs | CSS `@keyframes` + `radial-gradient` + `blur(80px)` |
| Cursor glow | Framer Motion `useMotionValue` + `useSpring` |
| Typewriter | Framer Motion `animate` controlling text slice |
| Scroll reveal | Framer Motion `whileInView` + `variants` |
| Stagger entrance | Framer Motion `staggerChildren` |
| 3D card tilt | CSS `perspective` + Framer Motion `rotateX/Y` |
| Parallax | Framer Motion `useScroll` + `useTransform` |
| Number counter | Framer Motion `useMotionValue` + `animate` |
| Pipeline light | CSS `@keyframes` along path |
| Connection line | Framer Motion `scaleY` + `useScroll` |
| Confetti | CSS `@keyframes` random scatter |
| Shimmer button | CSS `@keyframes` gradient sweep |
| Infinite carousel | CSS `@keyframes` continuous translate |
| Breathing glow | CSS `@keyframes` box-shadow pulse |

### Reused Assets
- `GlassCard` component (variant="interactive", "elevated")
- `EmployeeAvatar` component (size="lg")
- `EMPLOYEE_META` constants for employee data
- Glass design tokens from `globals.css`
- Dark mode via existing `next-themes` + CSS variables

### Performance
- `whileInView` for lazy animation triggers
- `will-change: transform` for GPU acceleration on orbs
- `useSpring` with built-in throttling for cursor follow
- Mobile: disable cursor glow + 3D tilt via media query
- Lazy load all non-critical assets

### Trade-offs
- **CSS orbs vs Canvas particles**: CSS orbs are less realistic but integrate better with glass UI aesthetic and have zero performance overhead
- **Framer Motion vs GSAP**: Framer Motion is already in the project; GSAP would add ~30KB for marginal benefit
- **Single page vs route group**: All sections in one client component for smooth scroll anchoring; no need for a route group

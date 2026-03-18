# Vibetide 炫酷落地页设计文档

> 日期: 2026-03-09
> 状态: 已批准

## 概述

为 Vibetide（Vibe Media）数智全媒平台设计一个炫酷的产品落地页，替换当前根路由 `/` 的纯重定向逻辑。未登录用户看到落地页，已登录用户自动跳转到 `/team-hub`。

## 设计决策

- **视觉风格**：毛玻璃渐变风，延续项目现有 Glass UI 设计语言
- **动画方案**：纯 CSS + Framer Motion（零新依赖），重度动画
- **技术方案**：Framer Motion 12.x（已安装）+ Tailwind CSS v4 + 现有 Glass 设计 token
- **内容语言**：全中文

## 页面结构（7 个板块）

### 板块 1：Hero 区

**布局**：全屏高度（`min-h-screen`），垂直居中内容

**背景层**（3 层叠加）：
- **底层**：延续项目现有渐变 `linear-gradient(135deg, #F8FBFF → #EEF4FF)`
- **中层**：3-4 个浮动光球（CSS `radial-gradient`，颜色取自 AI 员工色板：amber、purple、blue、teal），`@keyframes` 缓慢漂移 + 缩放，周期 15-25s，叠加 `blur(80px)`
- **顶层**：鼠标跟随光效 — 跟随光标的半透明渐变圆（Framer Motion `useMotionValue` + `useSpring`），`blur(120px)`

**内容**：
- 顶部导航栏：Logo「Vibe Media」+ 锚点链接（功能 / 团队 / 流程 / 案例）+ 「登录」「免费体验」按钮，毛玻璃背景，滚动时 sticky
- 主标题：**「2个编辑 + 1支AI团队 = 全能新媒体军团」** — 打字机效果逐字显现，「AI团队」渐变色高亮
- 副标题：「数智全媒平台 · 从热点发现到全渠道分发，AI全链路赋能」— fade-in 延迟
- 双 CTA：「立即体验」（实心渐变）+「了解更多」（毛玻璃描边），hover 发光扩散
- 底部：向下滚动提示箭头，bounce 动画

**动画时序**：导航栏(0s) → 主标题打字机(0.3s) → 副标题 fade-in(1.5s) → CTA slide-up(2s) → 背景光球持续漂移

### 板块 2：AI 团队展示

**标题**：「认识你的 AI 团队」— 滚动入场 fade-up

**布局**：4×2 网格（桌面），2×4（平板），1×8（手机）

**卡片设计**（8 个 AI 员工）：
- 毛玻璃卡片：`GlassCard variant="interactive"`
- 顶部：员工专属颜色渐变光晕，`blur(40px)`
- 头像：`EmployeeAvatar` size="lg"，外圈发光环 pulse 动画
- 名称 + 职称：如「小雷 · 热点猎手」
- 技能标签：2-3 个核心技能，毛玻璃 badge
- 一句话描述

**动画**：
- 入场：stagger slide-up + fade-in（间隔 0.1s）
- 悬停：3D 倾斜（`perspective(800px)` + `rotateX/Y` 跟随鼠标）+ 光晕增亮 + 上浮
- idle：头像光环呼吸闪烁（2s 周期），8 个员工节奏错开形成波浪

**数据来源**：`EMPLOYEE_META`（`src/lib/constants.ts`）

### 板块 3：核心能力

**标题**：「四大核心引擎」— fade-up

**布局**：左右交替 zigzag，奇数「图左文右」偶数「文左图右」

**四个能力块**：
1. **智创生产**（blue）：灵感挖掘→超级创作→批量生产→精品输出
2. **AI 资产重构**（purple）：媒资理解→知识图谱→素材复活→智能标签
3. **全渠道传播**（teal）：一键多平台→最佳时段→渠道顾问→数据回流
4. **AI 团队引擎**（amber）：员工编排→技能组合→工作流引擎→自主进化

**每块结构**：大号渐变序号（01-04）+ 标题 + 要点列表 | 毛玻璃面板抽象示意图

**动画**：
- 滚动视差：文字侧和图示侧不同速度滚入
- 连接线：左侧竖向渐变线，滚动时逐段点亮（`scaleY` + `transform-origin: top`）

### 板块 4：工作流演示

**标题**：「AI 全链路协作，一条龙搞定」

**流水线**（6 步）：
1. 热点捕获（小雷）→ 2. 选题策划（小策）→ 3. 内容创作（小文）→ 4. 视频制作（小剪）→ 5. 质量审核（小审）→ 6. 渠道分发（小发）

**视觉**：圆形头像节点 + 渐变连接线 + 流动光点 + 毛玻璃卡片

**核心动画 — 滚动触发流水线**：
- 进入视口后从左到右依次激活（间隔 0.4s）
- 未激活灰色 → 激活中脉冲放大 → 已激活保持员工色
- 连接线上光点流过
- 全部完成后「完成」徽章弹入 + 撒花效果

**底部数据条**：「全流程：~3 分钟」vs「人工：~4 小时」

### 板块 5：数据统计

**布局**：全宽渐变背景带，4 列网格

**数据**：
- **8** — AI 专业员工
- **28+** — 内置专业技能
- **80%** — 效率提升
- **4** — 核心引擎模块

**视觉**：渐变填色大数字（`text-7xl`，`bg-clip-text`），短横线装饰，背景光球

**动画**：数字从 0 滚动到目标值（2s，easeOut），符号 pop-in，背景光球同步膨胀

### 板块 6：场景案例

**标题**：「实战场景，即刻上手」

**3 张卡片**：
1. **突发快讯**（Zap）：5 分钟极速响应，~5min
2. **深度专题**（BookOpen）：从选题到万字长文，~30min
3. **日常运营**（Calendar）：每日内容矩阵，每日自动

**卡片设计**：`GlassCard variant="elevated"`，顶部彩色图标圆，底部员工头像 overlap 排列

**动画**：stagger slide-up 入场，悬停上浮 + 图标旋转 + 头像展开，移动端无限轮播

### 板块 7：CTA 底部

**背景**：加强版渐变 + 弧形分隔 + 大光球呼吸 + 漂浮圆点

**内容**：
- 主标语：「让 AI 团队，成为你的内容引擎」
- 副文案：「无需复杂配置，注册即可开始。你的 8 位 AI 同事已就位。」
- CTA：「立即开始」→ `/register` +「登录账号」→ `/login`
- 提示：「免费使用，无需信用卡」

**Footer**：「© 2026 Vibe Media · 数智全媒平台」+ 链接

**动画**：标语 scale 0.9→1.0 + fade-in，按钮 slide-up，shimmer 光泽扫过效果

## 技术实现要点

### 路由策略
- `src/app/page.tsx`：Server Component，检查 auth 状态
  - 已登录 → redirect 到 `/team-hub`
  - 未登录 → 渲染 `<LandingPage />` Client Component

### 文件结构
```
src/app/
  page.tsx                          # Server: auth check + 条件渲染
  landing/
    landing-page.tsx                # "use client" 主组件
    sections/
      hero-section.tsx              # Hero 区
      team-section.tsx              # AI 团队展示
      capabilities-section.tsx      # 核心能力
      workflow-section.tsx          # 工作流演示
      stats-section.tsx             # 数据统计
      scenarios-section.tsx         # 场景案例
      cta-section.tsx               # CTA + Footer
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

### 动画技术清单
| 效果 | 实现方式 |
|------|---------|
| 浮动光球 | CSS `@keyframes` + `radial-gradient` + `blur` |
| 鼠标跟随光效 | Framer Motion `useMotionValue` + `useSpring` |
| 打字机 | Framer Motion `animate` 控制文字切片 |
| 滚动入场 | Framer Motion `whileInView` + `variants` |
| Stagger 入场 | Framer Motion `staggerChildren` |
| 3D 卡片倾斜 | CSS `perspective` + Framer Motion `rotateX/Y` |
| 视差滚动 | Framer Motion `useScroll` + `useTransform` |
| 数字计数器 | Framer Motion `useMotionValue` + `animate` |
| 流水线光点 | CSS `@keyframes` 沿路径移动 |
| 连接线点亮 | Framer Motion `scaleY` + `useScroll` |
| 撒花效果 | CSS `@keyframes` 随机散落粒子 |
| Shimmer 按钮 | CSS `@keyframes` 渐变扫过 |
| 无限轮播 | CSS `@keyframes` 连续平移 |
| 呼吸光环 | CSS `@keyframes` box-shadow pulse |

### 复用现有资源
- `GlassCard`、`EmployeeAvatar` 组件直接复用
- `EMPLOYEE_META` 常量驱动员工数据
- Glass 设计 token（`globals.css` 中的 CSS 变量）
- 暗色模式自动适配（现有 `next-themes` + CSS 变量）

### 性能考量
- 所有 section 使用 `whileInView` 延迟渲染动画，减少初始负载
- 光球使用 `will-change: transform` 提示 GPU 加速
- 鼠标跟随使用 `useSpring` 自带节流
- 移动端禁用鼠标跟随光效和 3D 倾斜（`useMediaQuery` 检测）
- 图片资源懒加载

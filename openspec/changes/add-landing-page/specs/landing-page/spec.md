# Landing Page

产品落地页，展示 Vibetide 平台的核心功能和价值主张。

## ADDED Requirements

### Requirement: Root Route Landing Page (LP-01)
The system MUST display the landing page to unauthenticated users visiting `/`, and MUST redirect authenticated users to `/team-hub`.

#### Scenario: Unauthenticated user visits root
- **Given** 用户未登录
- **When** 访问 `/`
- **Then** 显示落地页，包含导航栏、Hero 区及所有内容板块

#### Scenario: Authenticated user visits root
- **Given** 用户已登录
- **When** 访问 `/`
- **Then** 重定向到 `/team-hub`

### Requirement: Hero Section with Animated Background (LP-02)
The landing page MUST render a full-screen Hero section with animated floating orbs background, cursor-following glow effect, typewriter title animation, and dual CTA buttons.

#### Scenario: Hero section loads
- **Given** 落地页加载完成
- **When** Hero 区渲染
- **Then** 显示浮动光球动画背景、主标题逐字打字机显现、副标题延迟 fade-in、两个 CTA 按钮 slide-up 入场

#### Scenario: Cursor glow follows mouse
- **Given** 用户在桌面端浏览 Hero 区
- **When** 移动鼠标
- **Then** 半透明光效跟随光标移动，带弹簧阻尼效果

### Requirement: AI Team Showcase (LP-03)
The landing page MUST display an interactive card grid of 8 AI employees, with data sourced from `EMPLOYEE_META` constants.

#### Scenario: Team section displays employees
- **Given** 用户滚动到团队展示区
- **When** 板块进入视口
- **Then** 8 张员工卡片依次 stagger 入场，显示头像、名称、职称、技能标签

#### Scenario: Employee card hover interaction
- **Given** 用户在桌面端查看员工卡片
- **When** 鼠标悬停在卡片上
- **Then** 卡片产生 3D 倾斜效果跟随鼠标位置，光晕亮度增加

### Requirement: Core Capabilities Section (LP-04)
The landing page MUST present 4 core platform modules in a zigzag layout with scroll parallax effects and an animated connection line.

#### Scenario: Capabilities section scrolls in
- **Given** 用户滚动到核心能力区
- **When** 每个能力块进入视口
- **Then** 文字侧和图示侧以不同速度滚入（视差效果），左侧连接线逐段点亮

### Requirement: Workflow Pipeline Animation (LP-05)
The landing page MUST show a 6-step content production pipeline that activates sequentially on scroll.

#### Scenario: Pipeline activates on scroll
- **Given** 用户滚动到工作流演示区
- **When** 板块进入视口
- **Then** 6 个流水线节点从左到右依次激活（间隔 0.4s），连接线上光点流过，全部完成后显示完成徽章

### Requirement: Animated Statistics Counter (LP-06)
The landing page MUST display 4 animated counters that scroll from 0 to target values when the section enters the viewport.

#### Scenario: Stats counter triggers
- **Given** 用户滚动到数据统计区
- **When** 板块进入视口
- **Then** 4 组数字从 0 滚动到目标值（2s 时长），符号 pop-in 出现

### Requirement: Scenario Cards (LP-07)
The landing page MUST display 3 scenario case study cards with participating AI employee avatars.

#### Scenario: Scenario cards display
- **Given** 用户滚动到场景案例区
- **When** 板块进入视口
- **Then** 3 张场景卡片 stagger slide-up 入场，底部显示参与员工头像

### Requirement: CTA Footer Section (LP-08)
The landing page MUST include a bottom CTA section that SHALL navigate to `/register` and `/login` respectively.

#### Scenario: CTA buttons navigate correctly
- **Given** 用户在 CTA 底部区域
- **When** 点击「立即开始」按钮
- **Then** 导航到 `/register`
- **When** 点击「登录账号」按钮
- **Then** 导航到 `/login`

### Requirement: Responsive Design (LP-09)
The landing page MUST adapt to desktop, tablet, and mobile viewports. Mobile devices MUST disable cursor-following and 3D tilt effects.

#### Scenario: Mobile layout adaptation
- **Given** 用户在移动端访问
- **When** 页面渲染
- **Then** 网格布局自动适配为单列，禁用鼠标跟随和 3D 倾斜效果，场景卡片切换为轮播模式

### Requirement: Dark Mode Support (LP-10)
The landing page MUST support dark mode with all visual elements automatically adapting to dark theme tokens.

#### Scenario: Dark mode toggle
- **Given** 用户系统或手动切换为暗色模式
- **When** 页面渲染
- **Then** 所有背景、卡片、文字、光效使用暗色 token，视觉效果保持一致

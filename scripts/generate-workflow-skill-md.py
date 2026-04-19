#!/usr/bin/env python3
"""
generate-workflow-skill-md.py
为 18 个新增 workflow (DEMO_DAILY 10 + EMPLOYEE_DAILY 8) 生成 baoyu 规范的
SKILL.md 文件到 workflows/<slug>/SKILL.md。

用 Python 是因为 TypeScript string 嵌套双引号处理麻烦；Python triple-quoted
string 和字典表示中文内容嵌套引号无任何负担。

Usage:  python3 scripts/generate-workflow-skill-md.py
"""
import os
from pathlib import Path

EMPLOYEE_MAP = {
    "xiaolei": "热点分析师",
    "xiaoce": "选题策划师",
    "xiaozi": "素材研究员",
    "xiaowen": "内容创作师",
    "xiaojian": "视频制片人",
    "xiaoshen": "质量审核官",
    "xiaofa": "渠道运营师",
    "xiaoshu": "数据分析师",
}

CATEGORY_LABELS = {
    "daily_brief": "日常简报",
    "deep": "深度内容",
    "news": "新闻资讯",
    "podcast": "播客音频",
    "livelihood": "民生内容",
    "video": "视频制作",
    "analytics": "数据分析",
    "distribution": "渠道分发",
    "custom": "通用场景",
}

# ============================================================================
# 18 份 Workflow 元数据
# ============================================================================

WORKFLOWS = [
    # ─── DEMO_DAILY (10) ───────────────────────────────────────────────────
    {
        "slug": "daily_ai_brief",
        "name": "每日 AI 资讯",
        "description": "每天聚合全网 AI / 大模型领域最新资讯，生成每日 AI 简报图文稿，发布到新闻 APP。",
        "category": "daily_brief",
        "icon": "Brain",
        "defaultTeam": ["xiaolei", "xiaowen", "xiaofa"],
        "appChannelSlug": "app_news",
        "systemInstruction": "围绕 AI / 大模型领域，聚合今日全网热点，生成一份每日 AI 资讯简报。结构：1) 今日头条 AI 事件（3-5 条）2) 技术突破 3) 商业动态 4) 监管政策 5) 行业观察。字数 1200-2000。风格：专业快讯，面向技术关注者。",
        "inputFields": [
            {"name": "topicTag", "label": "话题标签", "type": "text", "required": False, "placeholder": "AI"},
            {"name": "targetWordCount", "label": "目标字数", "type": "number", "required": False, "placeholder": "1500"},
        ],
        "steps": [
            {"order": 1, "name": "全网 AI 资讯聚合", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "热点价值评估", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "AI 简报生成", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
            {"order": 4, "name": "质量审核", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
            {"order": 5, "name": "发布到新闻 APP", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**信源权威性**：优先采信 OpenAI / Anthropic / DeepMind 官方博客、arXiv 论文、The Information / Bloomberg / 36Kr / 量子位等一级媒体；对 Twitter 转述、未署名自媒体报道标注「待验证」。',
            '**技术深度要求**：涉及模型参数 / 基准分数 / 论文作者时必须给出具体数字和来源链接，不能模糊表述（如「提升很大」→「在 MMLU 上提升 3.2 分」）。',
            '**时效性**：所有事件时间戳必须精确到小时（UTC 或 CST 明确标注），跨时区事件用 CST 统一表达。',
            '**避免过度炒作**：禁用「颠覆」「吊打」「碾压」等情绪词；用「显著超越」「相较提升 X%」等中性表达。',
            '**政策解读合规**：涉及中美 AI 监管动态必须客观陈述政策原文，不加主观立场评论。',
        ],
        "outputExample": "标题：每日 AI 资讯 · 2026-04-20\n\n1️⃣ 今日头条（3-5 条）\n   • OpenAI 发布 GPT-5 Turbo，MMLU 91.3 分（提升 1.8 分）…\n\n2️⃣ 技术突破\n   • Anthropic Claude 4.7 发布 1M 上下文版本…\n\n3️⃣ 商业动态\n4️⃣ 监管政策\n5️⃣ 行业观察",
        "triggerHint": "**触发方式**：① Inngest cron 每日 08:30 自动运行（推荐）② 首页「场景快捷启动」卡片手动触发 ③ 员工详情页「日常工作流」启用后由员工自主调度。",
    },
    {
        "slug": "weekly_tech_report",
        "name": "科技周报",
        "description": "每周深度整理科技行业重点事件，生成 3000+ 字深度解读周报，发布到新闻 APP。",
        "category": "deep",
        "icon": "Newspaper",
        "defaultTeam": ["xiaolei", "xiaoce", "xiaowen", "xiaoshen", "xiaofa"],
        "appChannelSlug": "app_news",
        "systemInstruction": "过去 7 天科技行业重点事件深度解读。结构：1) 本周十大事件排名 2) 重点事件深度分析 (3-5 篇) 3) 数据洞察 4) 下周预告。每事件 500+ 字，总篇幅 3000-5000 字。风格：专业深度，有观点。",
        "inputFields": [
            {"name": "weekRange", "label": "本周时间范围", "type": "text", "required": False, "placeholder": "2026-04-14 至 2026-04-20"},
            {"name": "focusSectors", "label": "重点细分领域", "type": "text", "required": False, "placeholder": "AI, 新能源, 芯片"},
        ],
        "steps": [
            {"order": 1, "name": "全周科技事件抓取", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "事件筛选与排名", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "数据洞察分析", "skillSlug": "data_report", "skillName": "数据报告", "skillCategory": "analysis"},
            {"order": 4, "name": "深度周报撰写", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
            {"order": 5, "name": "质量与合规审核", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
            {"order": 6, "name": "发布到新闻 APP", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**周度覆盖完整**：抓取区间必须严格等于 [上周一 00:00, 本周日 23:59]，跨周事件按首次发生时间归档。',
            '**排名可解释**：Top 10 事件排名必须给出打分矩阵（影响力 × 时效性 × 行业关注度），不能拍脑袋。',
            '**深度分析有观点**：每篇 500+ 字深度分析必须包含一个明确的「编辑部观点」（用「本报观察」/「编辑部认为」标识）。',
            '**数据可追溯**：引用的市场份额/营收数字必须给出一级信息源（财报 / 行业报告原文链接）。',
            '**下周预告前瞻性**：至少点名 3 个下周确定发生的事件（发布会/财报/会议），禁止「据传」「可能」等猜测性表述。',
        ],
        "outputExample": "标题：科技周报 2026 第 16 周（4.14-4.20）\n\n一、本周十大事件\n1. OpenAI 发布 GPT-5 Turbo（影响力 9.2）\n2. 苹果 M5 芯片定档 2026H2（影响力 8.7）\n…\n\n二、深度解读\n【事件 1 深度】GPT-5 Turbo 会否终结 Anthropic 优势？（800 字）\n…",
        "triggerHint": "**触发方式**：Inngest cron 每周日 20:00 自动运行，或首页「场景快捷启动」手动触发。",
    },
    {
        "slug": "daily_politics",
        "name": "每日时政热点",
        "description": "每天聚合时政领域重要动态，严档审核后生成时政图文稿，发布到时政 APP。",
        "category": "news",
        "icon": "Landmark",
        "defaultTeam": ["xiaolei", "xiaowen", "xiaoshen", "xiaofa"],
        "appChannelSlug": "app_politics",
        "systemInstruction": "聚合今日时政重要动态。结构：1) 今日时政要闻（3-5 条）2) 政策解读 3) 官方表态。字数 800-1500。**严档审核**：政治站位、敏感词、未授权信息一律拒。风格：严谨、客观、权威。",
        "inputFields": [
            {"name": "focusRegion", "label": "重点地域", "type": "select", "required": False, "placeholder": "全国", "options": ["全国", "深圳", "广东", "北京"]},
        ],
        "steps": [
            {"order": 1, "name": "官方信源采集", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "要闻筛选", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "合规前置扫描", "skillSlug": "compliance_check", "skillName": "合规审核", "skillCategory": "management"},
            {"order": 4, "name": "时政稿件撰写", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
            {"order": 5, "name": "严档质量审核", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
            {"order": 6, "name": "发布到时政 APP", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**严档审核必过**：政治站位错误、领导人表述不当、敏感词命中、未授权消息一律 **直接拒发**，不允许「人工审核」降档通过。',
            '**信源白名单**：仅接受新华社、人民日报、央视新闻、国务院客户端、中央纪委国家监委网站、省级党报党媒为一级信源；公众号/微博/抖音账号一律不作为原发信源。',
            '**领导人表述**：党和国家领导人姓名职务必须严格对照最新官方称谓，不得简写或错序；涉及会议、讲话、批示必须标注发布日期和会议名称。',
            '**政策原文优先**：重要政策解读必须附政策原文链接，解读文字不得超过政策原文字数的 3 倍，避免过度引申。',
            '**网信办负面词清单**：接入最新负面词库，100% 扫描不可豁免；命中即中断工作流。',
        ],
        "outputExample": "标题：【时政要闻】2026-04-20 · 深圳\n\n一、今日要闻\n1. 深圳 AI 产业条例正式实施…\n\n二、政策解读\n【条例深度】…（客观陈述，不加主观观点）",
        "triggerHint": "**触发方式**：Inngest cron 每日 07:00（T+1 滞后 1 小时等候官方最新表述）。",
    },
    {
        "slug": "daily_podcast",
        "name": "每日热点播客",
        "description": "每日把今日全网热点整理成播客脚本（音频稿），推送到 AIGC 渲染后发布到播客 APP。",
        "category": "podcast",
        "icon": "Mic",
        "defaultTeam": ["xiaoce", "xiaowen", "xiaofa", "xiaojian"],
        "appChannelSlug": "app_livelihood_podcast",
        "systemInstruction": "把今日 5-7 条全网热点整理成 8-12 分钟的对话体播客脚本。结构：1) 开场白 30s 2) 热点逐条点评（每条 1-2 分钟）3) 结尾互动 30s。双主持对话，自然、有网感、口语化。",
        "inputFields": [
            {"name": "format", "label": "播客格式", "type": "select", "required": False, "placeholder": "daily_brief", "options": ["daily_brief", "deep_dive", "weekend_chat"]},
            {"name": "targetMinutes", "label": "目标时长（分钟）", "type": "number", "required": False, "placeholder": "10"},
        ],
        "steps": [
            {"order": 1, "name": "今日热点聚合", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "热点筛选", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "播客脚本生成", "skillSlug": "podcast_script", "skillName": "播客脚本", "skillCategory": "generation"},
            {"order": 4, "name": "TTS 合成（AIGC）", "skillSlug": "audio_plan", "skillName": "音频规划", "skillCategory": "production"},
            {"order": 5, "name": "质量审核", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
            {"order": 6, "name": "发布到播客 APP", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**口语化不失专业**：脚本句长不超过 20 字（便于 TTS 停顿自然）；避免复杂从句和书面语（如「因此」→「所以」、「进行」→省略）。',
            '**双主持人设稳定**：主持 A 理性派（偏分析）、B 感性派（偏共情），两人名字/口头禅保持一致性（全季度不变）。',
            '**时长精控**：按 180 字/分钟 TTS 语速计算字数上限（8 分钟 = 1440 字，10 分钟 = 1800 字）。超时自动截断或跳过热点。',
            '**版权合规**：禁止完整朗读他人原创文章；引用他人观点必须说明「据 XX 媒体报道」。',
            '**TTS 友好**：避免生僻多音字（用拼音标注提醒）、避免长数字（「一千两百」比「1200」自然）。',
        ],
        "outputExample": "【开场】\n主持A：大家好，欢迎收听每日热点…\n主持B：今天我们聊五件大事…\n\n【热点 1】OpenAI 发布 GPT-5 Turbo（1.5 分钟）\n主持A：先说最硬核的…\n主持B：你说我最关心哪个指标你猜？",
        "triggerHint": "**触发方式**：Inngest cron 每日 21:00（日终汇总）自动运行。",
    },
    {
        "slug": "daily_tandian",
        "name": "每日探店",
        "description": "每天从本地热门探店话题中选出 1 个生成探店脚本，推送到 AIGC 生成视频后发布到民生-探店 APP。",
        "category": "livelihood",
        "icon": "UtensilsCrossed",
        "defaultTeam": ["xiaoce", "xiaowen", "xiaojian", "xiaofa"],
        "appChannelSlug": "app_livelihood_tandian",
        "systemInstruction": "生成一份探店脚本。6 阶段流程：店门外 → 环境氛围 → 招牌菜品 → 试吃反应 → 人均消费 → 结尾推荐。每段配镜头/贴字/配音建议。字数 600-900。风格：真实、有人情味、有画面感。**合规**：广告法禁极限词；合作类内容必须声明。",
        "inputFields": [
            {"name": "city", "label": "城市", "type": "select", "required": True, "placeholder": "成都", "options": ["成都", "深圳", "重庆", "上海", "北京"]},
            {"name": "category", "label": "店型", "type": "select", "required": False, "placeholder": "餐饮", "options": ["餐饮", "茶饮", "烘焙", "甜品", "夜市"]},
        ],
        "steps": [
            {"order": 1, "name": "本地探店话题聚合", "skillSlug": "trending_topics", "skillName": "热榜聚合", "skillCategory": "perception"},
            {"order": 2, "name": "热门店铺筛选", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "探店脚本生成", "skillSlug": "tandian_script", "skillName": "探店脚本", "skillCategory": "generation"},
            {"order": 4, "name": "合规扫描", "skillSlug": "compliance_check", "skillName": "合规审核", "skillCategory": "management"},
            {"order": 5, "name": "AIGC 视频生成", "skillSlug": "video_edit_plan", "skillName": "视频剪辑方案", "skillCategory": "production"},
            {"order": 6, "name": "发布到探店 APP", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**广告法极限词**：严禁「最好吃」「第一」「唯一」「顶级」「绝味」等极限用语；改用「很有特色」「让人印象深刻」等。',
            '**合作类强制披露**：凡接受商家提供的餐食/住宿/礼品，标题末尾必须标注「#合作」；描述段第一句加「本次探店由 XX 邀请」。',
            '**真实性承诺**：不得虚构试吃体验；镜头脚本与实际拍摄必须一致，不得使用 stock 素材冒充现场。',
            '**价格透明**：人均消费必须精确到元（不含推广优惠），标注「（2026 年 4 月价格，以店内实际为准）」。',
            '**评价客观**：差评不用极端词（「难吃到吐」），用「个人不太适应」等中性表达。',
        ],
        "outputExample": "【镜头 1：店门外】镜头从街口推进…\n贴字：春熙路 / 营业中 / 今天探秘 XX\n配音：听说这家店在小红书上火了一周…",
        "triggerHint": "**触发方式**：Inngest cron 每日 11:30（午餐前发布），或首页「场景快捷启动」手动。",
    },
    {
        "slug": "daily_sports_report",
        "name": "每日川超战报",
        "description": "每天 22:30 赛后聚合当日川超联赛数据，生成战报并发布到体育 APP。",
        "category": "news",
        "icon": "Trophy",
        "defaultTeam": ["xiaolei", "xiaowen", "xiaoshu", "xiaofa"],
        "appChannelSlug": "app_sports",
        "systemInstruction": "赛后生成当日川超战报。结构：1) 比赛结果速报 2) 核心数据（射门/控球/关键球员）3) 精彩瞬间回顾 4) 赛后点评。字数 800-1200。风格：激情专业，数据说话。",
        "inputFields": [
            {"name": "matchDate", "label": "比赛日期", "type": "text", "required": False, "placeholder": "2026-04-19"},
        ],
        "steps": [
            {"order": 1, "name": "赛事数据采集", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "关键数据提取", "skillSlug": "data_report", "skillName": "数据报告", "skillCategory": "analysis"},
            {"order": 3, "name": "战报生成", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
            {"order": 4, "name": "质量审核", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
            {"order": 5, "name": "发布到体育 APP", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**数据来源一致性**：射门/控球/传球次数必须取自同一数据源（Opta / InStat / 川超官方），不混用。',
            '**球员姓名规范**：严格使用官方注册姓名，外籍球员中文译名对齐新华社译名表。',
            '**比分即时性**：发布时间与终场哨时间间隔不超过 30 分钟，否则「战报」变「回顾」。',
            '**伤病慎写**：未经官方确认的伤病信息只能写「疑似受伤」/「下场接受检查」，不得直接写伤情。',
            '**裁判争议中立**：涉及裁判判罚争议只陈述事实，不评判对错，用「引起现场球迷讨论」等中性表达。',
        ],
        "outputExample": "【川超战报】4.19 | 成都蓉城 2:1 四川九牛\n\n1️⃣ 结果速报\n成都蓉城主场 2:1 击败四川九牛…\n\n2️⃣ 核心数据\n射门对比 15 : 8，控球率 58% : 42%…",
        "triggerHint": "**触发方式**：Inngest cron 每日 22:30（赛后 30 分钟）；非比赛日跳过。",
    },
    {
        "slug": "daily_zhongcao",
        "name": "种草日更",
        "description": "每天从全网热门商品/趋势中提取素材生成种草文案，推送到民生-种草 APP。",
        "category": "livelihood",
        "icon": "Heart",
        "defaultTeam": ["xiaoce", "xiaowen", "xiaofa", "xiaoshu"],
        "appChannelSlug": "app_livelihood_zhongcao",
        "systemInstruction": "每日生成 1 篇种草文案，平台差异化（小红书 / 抖音 / B 站 / 视频号）。结构：钩子 → 痛点 → 解决方案（产品）→ 细节展示 → CTA。字数按平台 400-1200 浮动。**合规**：广告法极限词严禁；合作披露按《互联网广告管理办法》执行。",
        "inputFields": [
            {"name": "platform", "label": "目标平台", "type": "select", "required": True, "placeholder": "xiaohongshu", "options": ["xiaohongshu", "douyin", "bilibili", "video_channel"]},
            {"name": "productCategory", "label": "品类", "type": "select", "required": False, "placeholder": "美妆", "options": ["美妆", "数码", "家居", "食品", "穿搭", "母婴"]},
        ],
        "steps": [
            {"order": 1, "name": "热门商品/趋势聚合", "skillSlug": "trending_topics", "skillName": "热榜聚合", "skillCategory": "perception"},
            {"order": 2, "name": "品类筛选", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "种草脚本生成", "skillSlug": "zhongcao_script", "skillName": "种草脚本", "skillCategory": "generation"},
            {"order": 4, "name": "广告法合规扫描", "skillSlug": "compliance_check", "skillName": "合规审核", "skillCategory": "management"},
            {"order": 5, "name": "发布到种草 APP", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**广告法极限词**：严禁「最」「第一」「顶级」「国家级」「独家」等；改用「我的最爱」「让人惊喜」等个人化表达。',
            '**合作披露强制**：所有商业合作内容必须在开头声明「本文由 XX 赞助提供」，否则触发合规拒发。',
            '**平台差异化**：小红书 400-600 字 + emoji；抖音 60 秒口播脚本；B 站 5-8 分钟解说；视频号 1 分钟短视频。',
            '**功效声明合规**：美妆/食品不得声称医疗功效；医疗器械/药品一律不种草。',
            '**敏感品类禁区**：烟酒、处方药、金融理财产品、成人用品不得种草。',
        ],
        "outputExample": "【小红书·美妆】姐妹们！这款粉底绝了（个人体验）\n\n最近一直油皮卡粉到怀疑人生…\n直到遇见 XX 持妆粉底液…\n\n（以上为个人使用感受，不代表普适性）",
        "triggerHint": "**触发方式**：Inngest cron 每日 10:00（平台流量低谷期发布）。",
    },
    {
        "slug": "premium_content",
        "name": "精品内容",
        "description": "精心策划的高质量深度稿件：长文深度 + 多维度调研 + 数据图表，发布到新闻 APP 头条。",
        "category": "deep",
        "icon": "Gem",
        "defaultTeam": ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaofa"],
        "appChannelSlug": "app_news",
        "systemInstruction": "围绕用户指定的精品主题，生成 3000+ 字的深度稿件。结构：1) 悬念开头 2) 事件全景回顾 3) 多方观点（至少 3 方）4) 数据支撑 5) 深度洞察与展望。配 3-5 张图表。风格：高质量长文，有思辨深度。",
        "inputFields": [
            {"name": "topic", "label": "精品选题", "type": "text", "required": True, "placeholder": "深圳 AI 产业新政 200 亿解读"},
            {"name": "angles", "label": "分析角度", "type": "text", "required": False, "placeholder": "政策/市场/从业者三视角"},
            {"name": "targetWordCount", "label": "目标字数", "type": "number", "required": False, "placeholder": "3500"},
        ],
        "steps": [
            {"order": 1, "name": "多维度背景调研", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "核心观点萃取", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "数据支撑分析", "skillSlug": "data_report", "skillName": "数据报告", "skillCategory": "analysis"},
            {"order": 4, "name": "多角度深度撰写", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
            {"order": 5, "name": "事实核查", "skillSlug": "fact_check", "skillName": "事实核查", "skillCategory": "management"},
            {"order": 6, "name": "高级质量审核", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
            {"order": 7, "name": "发布到头条", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**多方观点真实性**：至少采访（或引用）3 个不同立场当事人观点；不得全文使用同一立场信源。',
            '**事实核查必过**：所有具体数字、人名、时间、地点必须通过 fact_check 核验；未核验一律改为「相关」「约」等模糊表达。',
            '**引文合规**：直接引语必须完整保留原文含义，不得断章取义；间接引语必须注明出处。',
            '**数据图表标注**：每张图表必须有数据来源、统计口径、时间范围三要素。',
            '**专家引用资格**：专家观点必须标注职务单位 + 相关领域经验，不得匿名引用。',
        ],
        "outputExample": "标题：深圳 AI 产业新政：200 亿能否复刻「基因工程奇迹」？\n\n（悬念开头 500 字）\n2026 年 4 月，深圳再次祭出「大手笔」…\n\n（全景回顾 800 字）\n（多方观点 800 字 - 政策制定者 / 企业家 / 学者）\n（数据支撑 600 字 + 3 图表）\n（深度洞察 500 字）",
        "triggerHint": "**触发方式**：首页「场景快捷启动」手动触发（精品内容不走 cron，编辑策划驱动）。",
    },
    {
        "slug": "local_news",
        "name": "本地新闻",
        "description": "每日聚合本地（城市/区）新闻要闻，生成本地新闻图文稿，发布到新闻 APP 本地频道。",
        "category": "news",
        "icon": "MapPin",
        "defaultTeam": ["xiaolei", "xiaowen", "xiaofa"],
        "appChannelSlug": "app_news",
        "systemInstruction": "聚合指定城市/区域的今日要闻。结构：1) 城市要闻 3-5 条 2) 民生动态 3) 政府公告 4) 本地活动预告。字数 800-1500。风格：贴近本地、实用导向。",
        "inputFields": [
            {"name": "city", "label": "城市", "type": "select", "required": True, "placeholder": "深圳", "options": ["深圳", "广州", "北京", "上海", "成都", "杭州"]},
            {"name": "district", "label": "区（可选）", "type": "text", "required": False, "placeholder": "南山区"},
        ],
        "steps": [
            {"order": 1, "name": "本地信源聚合", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "本地要闻筛选", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "本地新闻撰写", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
            {"order": 4, "name": "质量审核", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
            {"order": 5, "name": "发布到本地频道", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**地域精准**：每条新闻必须明确发生在指定城市/区内；跨地域事件（如涉及省级）必须说明「深圳相关」的具体体现。',
            '**民生导向**：每日至少 2 条直接涉及市民衣食住行的民生内容（医保、公交、物价、学区等）。',
            '**政府公告标注**：直接转自政府官网/12345 的公告必须标注「来源：XX 市人民政府官网」。',
            '**活动预告真实**：只预告已公开确认的活动（官网/官方公众号已发布），不预告「据传」活动。',
            '**本地语境**：用当地地名俗称（如深圳「南油」、北京「望京」）增加亲切感，但首次出现必须标注完整行政区划。',
        ],
        "outputExample": "【深圳本地】4.20 · 南山区\n\n一、城市要闻\n• 南山区 2026 义务教育招生政策发布…\n\n二、民生动态\n• 前海地铁 21 号线开通新站…\n\n三、政府公告\n• 南山区人民政府关于…（来源：南山区政府官网）",
        "triggerHint": "**触发方式**：Inngest cron 每日 06:30，或首页「场景快捷启动」按城市手动触发。",
    },
    {
        "slug": "national_daily_brief",
        "name": "全国热点图文",
        "description": "每日聚合全国性热点话题，生成全国热点图文稿，发布到首页 APP 头条位。",
        "category": "daily_brief",
        "icon": "Flame",
        "defaultTeam": ["xiaolei", "xiaowen", "xiaofa", "xiaoce"],
        "appChannelSlug": "app_home",
        "systemInstruction": "聚合今日全国性热点。结构：1) 今日头条（1 条最大）2) 十大热点排名（带一句摘要）3) 聚焦深度解读 1-2 条。字数 1500-2500。风格：权威聚合、高质量摘要。",
        "inputFields": [
            {"name": "topNCount", "label": "Top N", "type": "number", "required": False, "placeholder": "10"},
        ],
        "steps": [
            {"order": 1, "name": "全网热榜聚合", "skillSlug": "trending_topics", "skillName": "热榜聚合", "skillCategory": "perception"},
            {"order": 2, "name": "热点排名与筛选", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 3, "name": "聚合图文生成", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
            {"order": 4, "name": "质量审核", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
            {"order": 5, "name": "发布到首页头条", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**头条权威**：今日头条位选择必须是 24 小时内新华社/人民日报/央视同时报道的重大事件，否则降级到第二位。',
            '**Top 10 多元**：十大热点必须覆盖至少 4 个领域（时政/经济/科技/社会/文体/国际），避免单领域霸榜。',
            '**排名算法可解释**：每条附「热度分」（搜索量 × 互动量 × 媒体覆盖度），分数公式在页面底部脚注说明。',
            '**摘要精炼**：每条热点一句摘要不超过 40 字，必须包含「谁、发生了什么、为什么重要」三要素。',
            '**负面事件克制**：负面热点（事故/犯罪）必须使用中性客观表述，不得渲染细节。',
        ],
        "outputExample": "【今日头条】2026-04-20\n\n🔥 头条：国务院常务会议决定 AI 产业 2026 扶持政策…\n\n📊 Top 10 热点\n1. [时政] 国务院 AI 扶持政策（热度 98）\n2. [经济] 特斯拉 Q1 财报超预期（热度 92）\n…\n\n📖 聚焦深度：AI 政策深度解读（800 字）",
        "triggerHint": "**触发方式**：Inngest cron 每日 07:30（早报流量高峰前）+ 17:30（晚间刷新）两次自动运行。",
    },
    # ─── EMPLOYEE_DAILY (8) ────────────────────────────────────────────────
    {
        "slug": "employee_daily_xiaolei",
        "name": "热点分析师·每日全网热点",
        "description": "xiaolei 的日常工作流：全网热点监控 → 深度趋势分析 → 输出每日热点洞察简报。",
        "category": "news",
        "icon": "Radar",
        "defaultTeam": ["xiaolei"],
        "appChannelSlug": "app_news",
        "systemInstruction": "以热点分析师身份产出每日热点洞察。结构：1) 今日 Top 10 热点榜（含热度/趋势）2) 3 条值得追踪的深度选题 3) 舆情风向 4) 建议跟进动作。字数 800-1500。",
        "inputFields": [
            {"name": "domain", "label": "关注领域", "type": "select", "required": False, "placeholder": "全部", "options": ["全部", "科技", "财经", "文娱", "体育", "民生"]},
        ],
        "steps": [
            {"order": 1, "name": "全网热点采集", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "热度趋势分析", "skillSlug": "trend_monitor", "skillName": "趋势监控", "skillCategory": "perception"},
            {"order": 3, "name": "深度洞察提取", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 4, "name": "热点简报生成", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
        ],
        "professionalNotes": [
            '**多平台覆盖**：至少覆盖微博热搜、百度热搜、抖音热榜、头条、36Kr 五个主流平台。',
            '**趋势而非快照**：Top 10 必须标注「新上榜」/「持续上升」/「回落中」趋势标签。',
            '**深度选题可追踪**：每条深度选题必须给出后续 3 天可追踪的数据指标（搜索量/讨论量）。',
            '**舆情客观**：舆情风向用「讨论集中在 A/B/C 三点」陈述，不做好坏判断。',
        ],
        "outputExample": "【xiaolei 每日热点简报 · 4.20】\n\n一、今日 Top 10\n1. 🔥 新上榜：XXX（热度 95）\n…\n\n二、值得追踪\n• 选题 A（未来 3 天关注指标：…）",
        "triggerHint": "**触发方式**：员工详情页「日常工作流」启用后由 xiaolei 每日 08:00 自主调度；或手动点击卡片即时运行。",
    },
    {
        "slug": "employee_daily_xiaoce",
        "name": "选题策划师·每日选题会",
        "description": "xiaoce 的日常工作流：挖掘用户需求 → 多角度选题策划 → 输出可落地选题清单。",
        "category": "deep",
        "icon": "Lightbulb",
        "defaultTeam": ["xiaoce", "xiaolei"],
        "appChannelSlug": "app_news",
        "systemInstruction": "以选题策划师身份产出每日选题会内容。结构：1) 3-5 个核心候选选题（含背景/价值/受众）2) 每个选题的 3 个差异化角度 3) 推荐形态（图文/视频/播客）4) 预估完成周期。",
        "inputFields": [
            {"name": "focusArea", "label": "聚焦领域", "type": "text", "required": False, "placeholder": "可留空，自动从热点推导"},
            {"name": "targetCount", "label": "期望选题数", "type": "number", "required": False, "placeholder": "5"},
        ],
        "steps": [
            {"order": 1, "name": "热点背景调研", "skillSlug": "news_aggregation", "skillName": "新闻聚合", "skillCategory": "perception"},
            {"order": 2, "name": "用户需求洞察", "skillSlug": "audience_analysis", "skillName": "受众分析", "skillCategory": "analysis"},
            {"order": 3, "name": "多角度选题生成", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 4, "name": "选题价值评估", "skillSlug": "heat_scoring", "skillName": "热度评分", "skillCategory": "analysis"},
            {"order": 5, "name": "选题清单输出", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
        ],
        "professionalNotes": [
            '**差异化必须明显**：三个角度必须分别覆盖「事件层/原因层/影响层」或「专业/大众/业内」不同维度，避免「三个角度其实一个视角」。',
            '**可落地性评估**：每个选题给出可落地评分（素材可获取性 × 审核通过难度 × 受众匹配度），不能空想。',
            '**形态推荐有依据**：图文 / 视频 / 播客推荐必须结合选题特性（如数据密集型 → 图文；情绪驱动 → 视频；长解读 → 播客）。',
        ],
        "outputExample": "【xiaoce 选题会 · 4.20】\n\n候选 1：GPT-5 Turbo 对国产大模型的连锁冲击\n  角度 A：技术视角（差距量化）\n  角度 B：产业视角（投资风向）\n  角度 C：从业者视角（技能焦虑）\n  推荐形态：图文深度（5000 字）\n  完成周期：3 天",
        "triggerHint": "**触发方式**：员工详情页每日 09:30 自主运行，配合晨会使用。",
    },
    {
        "slug": "employee_daily_xiaozi",
        "name": "素材研究员·素材库归集",
        "description": "xiaozi 的日常工作流：指定主题 → 多源素材搜索 → 整合打标入库构建可检索媒资。",
        "category": "analytics",
        "icon": "Library",
        "defaultTeam": ["xiaozi"],
        "appChannelSlug": None,
        "systemInstruction": "以素材研究员身份为指定主题归集素材库。输出：1) 素材清单（文/图/视/音 分类）2) 每条素材的来源/时效/版权状态 3) 相关性评分 4) 建议用法。字段结构化便于检索。",
        "inputFields": [
            {"name": "topic", "label": "主题关键词", "type": "text", "required": True, "placeholder": "深圳 AI 产业新政"},
            {"name": "sourceScope", "label": "素材范围", "type": "select", "required": False, "placeholder": "全网", "options": ["全网", "官方", "国内媒体", "海外媒体", "社交平台"]},
        ],
        "steps": [
            {"order": 1, "name": "主题背景分析", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 2, "name": "多源素材搜索", "skillSlug": "web_search", "skillName": "全网搜索", "skillCategory": "perception"},
            {"order": 3, "name": "网页深度抓取", "skillSlug": "web_deep_read", "skillName": "网页深读", "skillCategory": "perception"},
            {"order": 4, "name": "素材打标入库", "skillSlug": "media_search", "skillName": "媒资搜索", "skillCategory": "knowledge"},
        ],
        "professionalNotes": [
            '**版权状态必标**：每条素材必须标注版权状态（CC0 / CC-BY / 仅引用 / 禁止转载），禁止归档版权不明素材。',
            '**来源可追溯**：所有素材保存原始 URL + 抓取时间戳 + 页面备份（web.archive.org 链接）。',
            '**相关性定量**：相关性评分 0-100，给出打分依据（关键词匹配/主题覆盖/权威度）。',
            '**入库字段标准化**：至少包含 title / source / url / type / publishedAt / copyright / relevance / summary 8 字段。',
        ],
        "outputExample": "【素材库 · 深圳 AI 产业新政】\n\n条目 1：\n  title: 深圳市 AI 产业发展条例（全文）\n  source: 深圳市政府官网\n  type: 政策原文\n  copyright: 政府公开信息（可引用）\n  relevance: 98\n  summary: 200 亿专项基金 + 12 条支持措施…",
        "triggerHint": "**触发方式**：按需手动触发（主题驱动）；或 xiaoce 选题会输出后自动触发归集。",
    },
    {
        "slug": "employee_daily_xiaowen",
        "name": "内容创作师·多版本内容",
        "description": "xiaowen 的日常工作流：主题 → 多风格标题/正文/摘要 → A/B 备选方案。",
        "category": "news",
        "icon": "PenLine",
        "defaultTeam": ["xiaowen"],
        "appChannelSlug": "app_news",
        "systemInstruction": "以内容创作师身份产出多版本稿件。结构：1) 3 个标题（专业/网感/悬念）2) 完整正文（1 个主版本 + 2 个风格变体）3) 分享摘要（≤80 字）4) 社交媒体版（≤ 200 字）。",
        "inputFields": [
            {"name": "topic", "label": "创作主题", "type": "text", "required": True, "placeholder": "主题或选题 ID"},
            {"name": "style", "label": "主风格", "type": "select", "required": False, "placeholder": "news_standard", "options": ["news_standard", "deep_analysis", "casual", "zhongcao"]},
            {"name": "targetWordCount", "label": "目标字数", "type": "number", "required": False, "placeholder": "1500"},
        ],
        "steps": [
            {"order": 1, "name": "主题素材梳理", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 2, "name": "多风格标题生成", "skillSlug": "headline_generate", "skillName": "标题生成", "skillCategory": "generation"},
            {"order": 3, "name": "主版本正文撰写", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
            {"order": 4, "name": "风格变体生成", "skillSlug": "style_rewrite", "skillName": "风格改写", "skillCategory": "generation"},
            {"order": 5, "name": "摘要与分享版", "skillSlug": "summary_generate", "skillName": "摘要生成", "skillCategory": "generation"},
        ],
        "professionalNotes": [
            '**标题 A/B/C 真差异**：专业版（专业术语 + 数字）/ 网感版（网梗 + 悬念）/ 悬念版（疑问句 + 反转）必须明显区分，不能都是同一套路。',
            '**风格变体保留事实**：变体改风格不改事实，所有人物/数据/时间保持一致。',
            '**分享摘要可独立阅读**：80 字摘要必须包含「谁/发生了什么」核心信息，不依赖正文上下文。',
            '**社交版平台适配**：微博版加话题标签；朋友圈版去话题加情绪词；抖音口播版用短句。',
        ],
        "outputExample": "【xiaowen 多版本输出】\n\n标题 A（专业）：GPT-5 Turbo MMLU 91.3 背后的架构改进\n标题 B（网感）：AI 界又地震了？OpenAI 这次放了核弹\n标题 C（悬念）：它能写代码、能聊天，现在连高考都能满分？\n\n主版本（1500 字）…\n风格变体 1（深度分析）…\n风格变体 2（口语轻松）…\n\n分享摘要（80 字）…\n社交版（200 字）…",
        "triggerHint": "**触发方式**：员工详情页手动触发（主题驱动，非定时）。",
    },
    {
        "slug": "employee_daily_xiaojian",
        "name": "视频制片人·视频制作方案",
        "description": "xiaojian 的日常工作流：脚本 → 分镜方案 + 封面 + 音频 + 剪辑指导一体化。",
        "category": "video",
        "icon": "Clapperboard",
        "defaultTeam": ["xiaojian", "xiaowen"],
        "appChannelSlug": "app_variety",
        "systemInstruction": "以视频制片人身份为指定脚本产出制作方案。结构：1) 完整分镜表（镜头号/时长/内容/贴字/配音/音效）2) 封面设计思路（3 版）3) 音频方案（BGM+配音风格）4) 剪辑节奏建议。",
        "inputFields": [
            {"name": "script", "label": "脚本 / 主题", "type": "textarea", "required": True, "placeholder": "粘贴脚本或输入视频主题"},
            {"name": "duration", "label": "目标时长", "type": "select", "required": False, "placeholder": "90s", "options": ["30s", "60s", "90s", "3min", "5min"]},
        ],
        "steps": [
            {"order": 1, "name": "脚本结构分析", "skillSlug": "topic_extraction", "skillName": "选题提取", "skillCategory": "analysis"},
            {"order": 2, "name": "分镜方案设计", "skillSlug": "video_edit_plan", "skillName": "视频剪辑方案", "skillCategory": "production"},
            {"order": 3, "name": "封面设计", "skillSlug": "layout_design", "skillName": "版式设计", "skillCategory": "production"},
            {"order": 4, "name": "音频配乐规划", "skillSlug": "audio_plan", "skillName": "音频规划", "skillCategory": "production"},
            {"order": 5, "name": "缩略图生成", "skillSlug": "thumbnail_generate", "skillName": "封面生成", "skillCategory": "generation"},
        ],
        "professionalNotes": [
            '**分镜时长精确到秒**：每个镜头时长之和必须 = 目标时长 ± 5%，不能随意拉伸压缩。',
            '**贴字不超过 15 字**：每条贴字不超过 15 个汉字（移动端 1.5 秒可读完）。',
            '**BGM 版权合规**：必须使用版权库（版权信 / 爱给网 / Artlist）或原创音乐，禁用未授权商业歌曲。',
            '**封面 3 版有梯度**：版 1 保守可靠、版 2 吸睛大胆、版 3 情绪化共鸣，分别适配不同分发场景。',
            '**剪辑节奏匹配平台**：抖音节奏 2-3 秒切一镜；B 站可以 5-8 秒长镜；视频号 3-5 秒。',
        ],
        "outputExample": "【分镜表】30s 抖音版\n| # | 时长 | 画面 | 贴字 | 配音 | 音效 |\n| 1 | 3s | 特写镜头 | 震惊开场 | … | 钟声 |\n| 2 | 5s | 全景展示 | 具体数字 | … | — |\n…\n\n【封面】\n版 1：数字+产品（理性）\n版 2：人物表情+大字(情绪)\n版 3：对比图（反差）",
        "triggerHint": "**触发方式**：xiaowen 脚本输出后自动触发；或员工详情页手动启动（脚本驱动）。",
    },
    {
        "slug": "employee_daily_xiaoshen",
        "name": "质量审核官·事实质量审核",
        "description": "xiaoshen 的日常工作流：稿件 → 事实核查 + 合规扫描 + 质量评分 + 修改建议。",
        "category": "custom",
        "icon": "ShieldCheck",
        "defaultTeam": ["xiaoshen"],
        "appChannelSlug": None,
        "systemInstruction": "以质量审核官身份对稿件做全面审核。输出：1) 事实核查结果（真伪/出处）2) 合规扫描（政治/广告法/法律/伦理）3) 质量评分（结构/文字/深度/可读性 4 维 0-100）4) 具体修改建议。",
        "inputFields": [
            {"name": "articleText", "label": "待审稿件", "type": "textarea", "required": True, "placeholder": "粘贴稿件内容"},
            {"name": "reviewTier", "label": "审核档位", "type": "select", "required": False, "placeholder": "standard", "options": ["relaxed", "standard", "strict"]},
        ],
        "steps": [
            {"order": 1, "name": "事实核查", "skillSlug": "fact_check", "skillName": "事实核查", "skillCategory": "management"},
            {"order": 2, "name": "合规扫描", "skillSlug": "compliance_check", "skillName": "合规审核", "skillCategory": "management"},
            {"order": 3, "name": "情感立场分析", "skillSlug": "sentiment_analysis", "skillName": "情感分析", "skillCategory": "analysis"},
            {"order": 4, "name": "质量综合评分", "skillSlug": "quality_review", "skillName": "质量审核", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**事实核查逐条**：所有具体数字、人名、时间、地点、引言逐条核查；不能抽样。',
            '**合规扫描 4 大维度**：政治（领导人表述/敏感词/境外负面）+ 广告法（极限词/虚假宣传）+ 法律（隐私/侵权/诽谤）+ 伦理（歧视/未成年保护）。',
            '**档位分明**：strict 档位只接受 95+ 分稿件；standard 85+；relaxed 75+。低于阈值自动拒。',
            '**修改建议可执行**：具体指出「第 X 段第 Y 句」问题 + 建议修改版本，不能只说「需改进」。',
        ],
        "outputExample": "【审核报告】档位：strict\n\n❌ 事实核查：3 处存疑\n  - 第 2 段第 3 句：「MMLU 95 分」→ 实际 91.3 分\n\n✅ 合规扫描：通过\n\n📊 质量评分\n  结构 88 / 文字 92 / 深度 85 / 可读性 90\n  综合 89（strict 档不通过）\n\n✏️ 修改建议（共 5 条）…",
        "triggerHint": "**触发方式**：所有内容生成工作流（content_generate）完成后自动触发；或手动审核指定稿件。",
    },
    {
        "slug": "employee_daily_xiaofa",
        "name": "渠道运营师·多渠道分发策略",
        "description": "xiaofa 的日常工作流：稿件 → 平台适配改写 + 发布时机 + 渠道路由。",
        "category": "distribution",
        "icon": "Send",
        "defaultTeam": ["xiaofa", "xiaowen"],
        "appChannelSlug": None,
        "systemInstruction": "以渠道运营师身份制定多渠道分发策略。输出：1) 各平台适配版（微博/微信/抖音/小红书/视频号/APP）2) 最佳发布时机表 3) 标签/话题/@建议 4) 预期效果预估。",
        "inputFields": [
            {"name": "articleId", "label": "稿件 ID", "type": "text", "required": False, "placeholder": "可留空，从上下文读取"},
            {"name": "targetPlatforms", "label": "目标平台", "type": "text", "required": False, "placeholder": "weibo, wechat, douyin"},
        ],
        "steps": [
            {"order": 1, "name": "平台特性分析", "skillSlug": "audience_analysis", "skillName": "受众分析", "skillCategory": "analysis"},
            {"order": 2, "name": "多平台适配", "skillSlug": "style_rewrite", "skillName": "风格改写", "skillCategory": "generation"},
            {"order": 3, "name": "时机与触达策略", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
            {"order": 4, "name": "渠道路由编排", "skillSlug": "publish_strategy", "skillName": "发布策略", "skillCategory": "management"},
        ],
        "professionalNotes": [
            '**平台字数规范**：微博 ≤140 字（长文分段推送）；微信头条 ≥ 2000 字；抖音口播 ≤ 180 字；小红书 400-600 字。',
            '**发布时机数据驱动**：给出的最佳时机必须基于过去 30 天同类内容的打开率数据，不能拍脑袋。',
            '**话题 @ 合规**：@ 账号必须是已获授权或公开机构账号；话题选择不得使用禁用话题（网信办黑名单）。',
            '**效果预估区间**：预估只给区间（如「微博阅读 5-10 万」），不给单点数字，避免过度承诺。',
        ],
        "outputExample": "【xiaofa 分发策略】\n\n微博版（138 字）：🔥【数字】…\n微信版（2500 字）：正文 + 图表 + 延伸阅读\n抖音版（180 字）：强钩子 + 数据 + CTA\n\n最佳发布时机：\n  微博 18:30（下班高峰）\n  微信 07:30（晨读高峰）\n  抖音 21:30（夜间高峰）\n\n预期：微博阅读 5-10W / 微信 5000-1W / 抖音播放 10-30W",
        "triggerHint": "**触发方式**：稿件审核通过后自动触发；或员工详情页手动策划分发。",
    },
    {
        "slug": "employee_daily_xiaoshu",
        "name": "数据分析师·数据复盘报告",
        "description": "xiaoshu 的日常工作流：稿件/项目 → 数据洞察 + 效果追踪 + 下一步建议。",
        "category": "analytics",
        "icon": "ChartColumn",
        "defaultTeam": ["xiaoshu"],
        "appChannelSlug": "app_home",
        "systemInstruction": "以数据分析师身份产出复盘报告。结构：1) 核心指标摘要（阅读/互动/转化）2) 趋势分析（日/周/月）3) 渠道对比 4) 用户画像 5) 优化建议。用图表描述（文本形式）。",
        "inputFields": [
            {"name": "targetType", "label": "复盘对象", "type": "select", "required": True, "placeholder": "article", "options": ["article", "mission", "daily_brief", "weekly"]},
            {"name": "targetId", "label": "对象 ID（可选）", "type": "text", "required": False},
        ],
        "steps": [
            {"order": 1, "name": "数据拉取", "skillSlug": "data_report", "skillName": "数据报告", "skillCategory": "analysis"},
            {"order": 2, "name": "趋势对比分析", "skillSlug": "data_report", "skillName": "数据报告", "skillCategory": "analysis"},
            {"order": 3, "name": "受众画像分析", "skillSlug": "audience_analysis", "skillName": "受众分析", "skillCategory": "analysis"},
            {"order": 4, "name": "复盘报告撰写", "skillSlug": "content_generate", "skillName": "内容生成", "skillCategory": "generation"},
        ],
        "professionalNotes": [
            '**指标可比较**：日/周/月趋势必须同期比较（MoM / YoY），不只看绝对值。',
            '**渠道对比标准化**：不同平台流量换算成「千人阅读成本 CPM」或「互动率」可比较指标。',
            '**用户画像 3 维**：年龄分布 / 地域分布 / 设备分布，三维都出。',
            '**优化建议可执行**：建议必须落到「下次同类稿件改进点 1/2/3」，不能说「加强质量」等空话。',
        ],
        "outputExample": "【xiaoshu 复盘报告 · 每日 AI 资讯 - 4.20】\n\n一、核心指标\n  阅读 8.5W（MoM +12% / YoY +45%）\n  互动率 3.2%（高于日常平均 2.1%）\n  转化率 0.8%\n\n二、趋势：阅读量过去 7 天呈 +15% / 天上升\n\n三、渠道对比：微信 CPM 最低（¥8），抖音最高（¥45）\n\n四、用户画像：25-35 男 67% / 一线 45% / 移动 89%\n\n五、优化建议\n1. 标题加数字可提升打开率（历史 +30%）\n2. 图表密度 3 张/千字最佳\n3. 抖音投放建议降为每周 2 条",
        "triggerHint": "**触发方式**：Inngest cron 每周一 09:00 自动跑上周复盘；或员工详情页手动触发单稿件复盘。",
    },
]

# ============================================================================
# MD 生成器
# ============================================================================

def render_input_table(wf):
    if not wf["inputFields"]:
        return "*无需用户输入，所有参数来自上下文。*"
    lines = ["| 字段 | 说明 | 类型 | 必填 | 示例 |", "|------|------|------|------|------|"]
    for f in wf["inputFields"]:
        required = "是" if f.get("required") else "否"
        lines.append(f"| `{f['name']}` | {f['label']} | {f['type']} | {required} | {f.get('placeholder', '—')} |")
    return "\n".join(lines)


def render_checklist(wf):
    return "\n".join(
        f"- [ ] **Step {s['order']}: {s['name']}** — 调 `{s['skillSlug']}`（{s['skillName']}，{s['skillCategory']}）"
        for s in wf["steps"]
    )


def render_step_details(wf):
    blocks = []
    for s in wf["steps"]:
        dep = f"Step {s['order'] - 1}" if s["order"] > 1 else "（无 — 流水线入口）"
        blocks.append(
            f"""### Step {s['order']}: {s['name']}

- **原子技能**：[`{s['skillSlug']}`](../../skills/{s['skillSlug']}/SKILL.md)（{s['skillName']}）
- **技能分类**：{s['skillCategory']}
- **上游依赖**：{dep}
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。"""
        )
    return "\n\n".join(blocks)


def render_team(wf):
    return "\n".join(f"- **{slug}**（{EMPLOYEE_MAP.get(slug, slug)}）" for slug in wf["defaultTeam"])


def build_md(wf):
    category_label = CATEGORY_LABELS.get(wf["category"], wf["category"])
    app_channel_line = (
        f"= `{wf['appChannelSlug']}`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定"
        if wf["appChannelSlug"]
        else "= null，不需要 CMS 绑定"
    )
    cms_line = (
        f"`publishArticleToCms({{ appChannelSlug: \"{wf['appChannelSlug']}\" }})` 写入华栖云"
        if wf["appChannelSlug"]
        else "*不入 CMS*"
    )
    cms_complete_check = (
        f"`articles` 表有新稿件，`cms_publications` 表有 `status='submitted'` 记录"
        if wf["appChannelSlug"]
        else "最终 artifact 已序列化"
    )
    cms_sideeffect = (
        f"`cms_publications` 新建入库记录 + Inngest `cms-status-poll` 5 次轮询"
        if wf["appChannelSlug"]
        else "*无 CMS 副作用*"
    )

    team_fm = "\n".join(f"    - {slug}" for slug in wf["defaultTeam"])

    pro_notes = "\n\n".join(f"**{i+1}.** {n}" for i, n in enumerate(wf["professionalNotes"]))

    skill_links = "".join(f"（{s['skillSlug']}）" for s in wf["steps"])

    return f"""---
name: {wf['slug']}
displayName: {wf['name']}
description: {wf['description']}
category: {wf['category']}
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - {category_label}
  compatibleEmployees:
{team_fm}
  appChannelSlug: {wf['appChannelSlug'] or 'null'}
  legacyScenarioKey: {wf['slug']}
---

# {wf['name']}

> {wf['description']}

## 1. 使用条件

{wf['triggerHint']}

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 {len(wf['steps'])} 个原子技能）
- `appChannelSlug` {app_channel_line}

**默认团队**：
{render_team(wf)}

## 2. 输入 / 输出

### 输入字段

{render_input_table(wf)}

### 系统指令（systemInstruction）

> {wf['systemInstruction']}

### 典型输出

```
{wf['outputExample']}
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：{cms_line}

## 3. 工作流 Checklist

按顺序执行以下 {len(wf['steps'])} 步（Mission Engine 按 `dependsOn` 拓扑排序）：

{render_checklist(wf)}

## 4. 子步骤详情

{render_step_details(wf)}

## 5. 质量把关

### 媒体行业专业要求

{pro_notes}

### 失败模式

| 失败模式 | 检测方法 | 处理策略 |
|---------|---------|---------|
| 原子技能超时 | `skills.runtimeConfig.avgLatencyMs × 3` | 自动重试 → 写入失败 → 人工介入 |
| 输出不符合 systemInstruction | `quality_review` 评分 < 80 | 自动重写（最多 2 次）→ 改人工 |
| 合规未过 | `compliance_check` 命中负面词 | **直接拒发，不降档** |
| CMS 发布失败 | `publishArticleToCms` 抛错 | Inngest `cms-publish-retry` 重试 3 次（指数退避） |

### 自检清单（workflow 完成后）

- [ ] 所有 Step 都有对应 artifact 落库
- [ ] `mission.status = 'completed'`
- [ ] {cms_complete_check}
- [ ] `mission_messages` 有完整的工作流日志

## 6. 输出模板

```
{wf['outputExample']}
```

## 7. 上下游协作

### 读哪些数据
- `hot_topics` / `trending_topics` 热点池（如涉及）
- `employee_memories` （负责员工的 Top-10 记忆）
- `knowledge_bases` 绑定的知识库
- 用户输入的 `inputFields`

### 触发哪些副作用
- `missions` 新建一条 mission（source_module = 场景触发来源）
- `mission_tasks` / `mission_artifacts` 按 Step 数量写入
- {cms_sideeffect}

### 下游监听
- `leader-consolidate` Inngest 函数（任务完成后触发自动入库）
- `employee-status-guard` （负责员工状态更新为 idle）
- `learning-engine` （从本次任务中提取经验写回员工记忆）

## 8. 常见问题

**Q1：为什么 workflow 跑了一半卡住？**
A：查 `missions/<id>` 详情页 → 看 `mission_tasks.status = 'running'` 但超时的任务 → 检查对应原子技能的 `runtimeConfig` 是否合理；Inngest cron `employee-status-guard` 会每 5 分钟自动清理 stuck 任务。

**Q2：可以修改 workflow 的步骤吗？**
A：可以。`/workflows/[id]` 页面「规格文档」Tab 编辑本 SKILL.md；步骤编排在「流程编辑」Tab（B.2 上线）。修改后 DB 和文件双向同步。

**Q3：如何禁用 workflow？**
A：`/workflows` 列表页切换「启用」开关，或 `workflow_templates.is_enabled = false`。Cron 触发会跳过禁用的 workflow。

## 9. EXTEND.md 示例

### 基础版（builtin，本文档）
- 默认团队：{' / '.join(wf['defaultTeam'])}
- 默认 {len(wf['steps'])} 步流水线

### 扩展思路

- **自定义团队**：在 `/workflows/[id]/edit` 修改 `defaultTeam` 替换员工
- **加中间步骤**：如在 content_generate 前加 `knowledge_retrieval` 做知识库检索
- **替换发布目标**：改 `appChannelSlug` 指向其他 CMS 栏目
- **改 cron**：`/workflows/[id]/edit` → triggerConfig.cron 修改（如 `0 8 * * *` → `0 7 * * *`）

## 10. 参考资料

- 场景入口：[/home 「场景快捷启动」](../../src/components/home/scenario-grid.tsx) + [/employee/[id] 日常工作流](../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx)
- Mission 引擎：[src/inngest/functions/](../../src/inngest/functions/)
- CMS 发布：`publishArticleToCms` in [src/lib/cms/](../../src/lib/cms/)
- 原子技能：[skills/](../../skills/) 目录{skill_links}
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
"""


# ============================================================================
# Main
# ============================================================================

def main():
    root = Path(__file__).resolve().parent.parent
    out_dir = root / "workflows"
    out_dir.mkdir(exist_ok=True)

    written = 0
    for wf in WORKFLOWS:
        d = out_dir / wf["slug"]
        d.mkdir(exist_ok=True)
        (d / "SKILL.md").write_text(build_md(wf), encoding="utf-8")
        print(f"  WROTE  workflows/{wf['slug']}/SKILL.md")
        written += 1

    print(f"\nDone: {written} SKILL.md files generated.")


if __name__ == "__main__":
    main()

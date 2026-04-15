export const dynamic = "force-dynamic";

export default function ResearchHomePage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">新闻研究</h1>
        <p className="text-muted-foreground text-sm">
          面向新闻传播学研究的检索、命中统计与报告生成工作台。后续阶段（S4）
          将在此提供研究任务中心。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="/research/admin/media-outlets"
          className="block rounded-xl bg-card p-5 hover:bg-accent transition"
        >
          <div className="font-medium mb-1">媒体源管理</div>
          <div className="text-sm text-muted-foreground">
            维护四级媒体（央/市/行业/区县）登记与抓取配置
          </div>
        </a>
        <a
          href="/research/admin/topics"
          className="block rounded-xl bg-card p-5 hover:bg-accent transition"
        >
          <div className="font-medium mb-1">主题词库管理</div>
          <div className="text-sm text-muted-foreground">
            管理研究主题、关键词（共词 + 近似称谓）与语义样本
          </div>
        </a>
      </div>
    </div>
  );
}

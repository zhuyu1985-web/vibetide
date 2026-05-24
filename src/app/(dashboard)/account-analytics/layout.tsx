/**
 * Account Analytics 模块统一容器 —— 限制最大宽度 + 居中，左右留白，避免在
 * 超宽屏（>= 1440px）下报告内容拉得过宽影响阅读体验。
 */
export default function AccountAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

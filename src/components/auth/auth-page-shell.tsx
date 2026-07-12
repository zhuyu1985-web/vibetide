import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthPageShell({
  title,
  subtitle,
  children,
  className,
}: AuthPageShellProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-page bg-glow px-4">
      <div className={cn("w-full max-w-[400px]", className)}>
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-sky-400/25 blur-xl scale-110" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Sparkles size={24} className="text-white" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Vibe Media
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">数智全媒平台</p>
          </div>
        </div>

        <div className="glass-secondary rounded-3xl p-8 shadow-[0_20px_60px_-24px_rgba(30,64,175,0.22)]">
          <div className="text-center mb-7">
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

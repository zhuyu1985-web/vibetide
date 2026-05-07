"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/app/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);

    // signIn server action 成功时会 redirect("/home")（throw NEXT_REDIRECT），
    // 失败时返回 { error }。但在国内访问 Supabase ap-northeast-2 慢网下，
    // server action 整体耗时 30+s 时偶发：cookie 已写入但 NEXT_REDIRECT 信号
    // 未能被 dev server 正确传给 client navigation —— 表现为登录后页面卡在
    // /login，必须手动刷新才能进 /home（cookie 已就位，proxy.ts 直接放行）。
    // 兜底：成功后主动 router.push + refresh，与 NEXT_REDIRECT 双保险。
    try {
      const result = await signIn(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
    } catch (err: unknown) {
      // NEXT_REDIRECT 是 Next.js 内部的"假错误"，不应中断流程；其它错才显示
      if (
        err instanceof Error &&
        (err.message === "NEXT_REDIRECT" ||
          (err as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
      ) {
        // fallthrough
      } else {
        setError("登录失败，请稍后重试");
        setLoading(false);
        return;
      }
    }
    // 兜底主动跳转 + 刷新（让 server-side cache 在新 session 下重新求值）
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page bg-glow">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles size={22} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Vibe Media</h1>
            <p className="text-xs text-muted-foreground">数智全媒平台</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-secondary rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-foreground text-center mb-1">
            登录
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            登录你的账号开始工作
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                邮箱
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                密码
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="password"
                  placeholder="输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "登录"
              )}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            还没有账号？{" "}
            <Link
              href="/register"
              className="text-primary hover:brightness-110 font-medium"
            >
              注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

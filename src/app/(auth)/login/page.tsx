"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import {
  LoginModeTabs,
  type LoginMode,
} from "@/components/auth/login-mode-tabs";
import { signIn } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell title="登录" subtitle="登录你的账号开始工作">
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        </AuthPageShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [loginMode, setLoginMode] = useState<LoginMode>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("logged_out") === "1") {
      setError("");
      return;
    }
    if (searchParams.get("error") === "sso_failed") {
      setError("免登失败，请使用手机号或邮箱密码登录");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("loginMode", loginMode);
    formData.set("phone", phone);
    formData.set("email", email);
    formData.set("password", password);

    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <AuthPageShell title="登录" subtitle="登录你的账号开始工作">
      <LoginModeTabs value={loginMode} onChange={setLoginMode} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div
          key={loginMode}
          className={cn(
            "space-y-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
          )}
        >
          {loginMode === "phone" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                手机号
              </label>
              <div className="relative">
                <Phone
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80"
                />
                <Input
                  type="tel"
                  placeholder="11 位手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-9 h-10"
                  inputMode="numeric"
                  autoComplete="tel"
                  pattern="1[3-9][0-9]{9}"
                  maxLength={11}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                邮箱
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80"
                />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">
              密码
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80"
              />
              <Input
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 h-10"
                autoComplete="current-password"
                required
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/8 rounded-xl px-3.5 py-2.5 leading-relaxed">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-10 text-[15px] font-medium mt-1"
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "登录"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-7">
        还没有账号？{" "}
        <Link
          href="/register"
          className="text-sky-600 dark:text-sky-400 hover:brightness-110 font-medium"
        >
          注册
        </Link>
      </p>
    </AuthPageShell>
  );
}

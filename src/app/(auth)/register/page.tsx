"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, User, Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { signUp } from "@/app/actions/auth";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("password", password);

    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <AuthPageShell title="注册" subtitle="创建账号，组建你的 AI 团队">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">姓名</label>
          <div className="relative">
            <User
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80"
            />
            <Input
              type="text"
              placeholder="你的姓名"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="pl-9 h-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">邮箱</label>
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
              required
            />
          </div>
        </div>

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

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">密码</label>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80"
            />
            <Input
              type="password"
              placeholder="至少 8 位密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 h-10"
              minLength={8}
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/8 rounded-xl px-3.5 py-2.5 leading-relaxed">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-10 text-[15px] font-medium"
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "注册"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-7">
        已有账号？{" "}
        <Link
          href="/login"
          className="text-sky-600 dark:text-sky-400 hover:brightness-110 font-medium"
        >
          登录
        </Link>
      </p>
    </AuthPageShell>
  );
}

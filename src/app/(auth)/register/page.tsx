"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/team-hub");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-950">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Sparkles size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Vibe Media</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">数智全媒平台</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-xl dark:shadow-black/20 p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-1">
            注册
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
            创建账号，组建你的 AI 团队
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                姓名
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <Input
                  type="text"
                  placeholder="你的姓名"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                邮箱
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
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
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                密码
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <Input
                  type="password"
                  placeholder="至少 6 位密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  minLength={6}
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
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "注册"
              )}
            </Button>
          </form>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-6">
            已有账号？{" "}
            <Link
              href="/login"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

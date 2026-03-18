"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  PenLine,
  FolderOpen,
  Type,
} from "lucide-react";
import { createArticle } from "@/app/actions/articles";
import Link from "next/link";
import type { CategoryNode } from "@/lib/types";

interface Props {
  categories: CategoryNode[];
}

export default function ArticleCreateClient({ categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [summary, setSummary] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [mediaType, setMediaType] = useState("article");

  const wordCount = body.length;

  function handleCreate() {
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createArticle({
        organizationId: "",
        title,
        body,
        summary,
        categoryId: categoryId || undefined,
        mediaType,
      });
      if (result.articleId) {
        router.push(`/articles/${result.articleId}`);
      }
    });
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="新建稿件"
        description="创建一篇新的内容稿件"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/articles">
                <ArrowLeft size={16} className="mr-2" />
                返回列表
              </Link>
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
              <PenLine size={16} className="mr-2" />
              创建
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Editor (2/3) */}
        <div className="col-span-2 space-y-4">
          <GlassCard padding="lg">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="mb-2">
                  标题
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="请输入稿件标题"
                  className="text-lg font-medium"
                />
              </div>

              <div>
                <Label htmlFor="body" className="mb-2">
                  正文
                </Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="请输入稿件正文内容..."
                  className="min-h-[400px] resize-y"
                />
              </div>

              <div>
                <Label htmlFor="summary" className="mb-2">
                  摘要
                </Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="请输入稿件摘要..."
                  className="min-h-[100px] resize-y"
                />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right: Metadata (1/3) */}
        <div className="space-y-4">
          <GlassCard padding="lg">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <FolderOpen size={16} className="text-blue-500" />
              稿件信息
            </h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="category" className="mb-2">
                  栏目
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="选择栏目" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mediaType" className="mb-2">
                  媒体类型
                </Label>
                <Select value={mediaType} onValueChange={setMediaType}>
                  <SelectTrigger id="mediaType" className="w-full">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="article">图文</SelectItem>
                    <SelectItem value="video">视频</SelectItem>
                    <SelectItem value="audio">音频</SelectItem>
                    <SelectItem value="h5">H5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Type size={14} />
                <span>字数：{wordCount}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

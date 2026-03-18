"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
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
  Save,
  SendHorizontal,
  ArrowLeft,
  Tag,
  Type,
  FolderOpen,
  MessageSquare,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateArticle, updateArticleStatus } from "@/app/actions/articles";
import Link from "next/link";
import type { ArticleDetail, CategoryNode, ChannelAdvisor } from "@/lib/types";

interface Props {
  article: ArticleDetail;
  categories: CategoryNode[];
  advisors: ChannelAdvisor[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  reviewing: { label: "审核中", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  approved: { label: "已通过", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  published: { label: "已发布", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  archived: { label: "已归档", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
};

export default function ArticleEditClient({ article, categories, advisors }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(article.body || "");
  const [summary, setSummary] = useState(article.summary || "");
  const [categoryId, setCategoryId] = useState(article.categoryId || "");
  const [mediaType, setMediaType] = useState(article.mediaType || "article");

  const wordCount = body.length;
  const statusCfg = statusConfig[article.status] || statusConfig.draft;

  function handleSave() {
    startTransition(async () => {
      await updateArticle(article.id, {
        title,
        body,
        summary,
        categoryId: categoryId || undefined,
        mediaType,
      });
    });
  }

  function handleSubmitReview() {
    startTransition(async () => {
      await updateArticle(article.id, { title, body, summary, categoryId: categoryId || undefined, mediaType });
      await updateArticleStatus(article.id, "reviewing");
      router.refresh();
    });
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="编辑稿件"
        description={article.title}
        actions={
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                statusCfg.color
              )}
            >
              {statusCfg.label}
            </span>
            <Button variant="outline" asChild>
              <Link href="/articles">
                <ArrowLeft size={16} className="mr-2" />
                返回列表
              </Link>
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={isPending}>
              <Save size={16} className="mr-2" />
              保存
            </Button>
            {(article.status === "draft" || article.status === "approved") && (
              <Button onClick={handleSubmitReview} disabled={isPending}>
                <SendHorizontal size={16} className="mr-2" />
                提交审核
              </Button>
            )}
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
          {/* Metadata Card */}
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

              <div>
                <Label className="mb-2">
                  <Tag size={14} className="text-gray-400 dark:text-gray-500" />
                  标签
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {article.tags.length > 0 ? (
                    article.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">暂无标签</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Type size={14} />
                <span>字数：{wordCount}</span>
              </div>

              {article.assigneeName && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <User size={14} />
                  <span>负责人：{article.assigneeName}</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Advisor Notes */}
          <GlassCard padding="lg">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-purple-500" />
              频道顾问建议
            </h3>

            {article.advisorNotes && article.advisorNotes.length > 0 ? (
              <div className="space-y-3">
                {article.advisorNotes.map((note, idx) => {
                  const advisor = advisors[idx % advisors.length];
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/50 border border-purple-100"
                    >
                      {advisor && (
                        <p className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-1">
                          {advisor.name}
                        </p>
                      )}
                      <p className="text-sm text-gray-700 dark:text-gray-300">{note}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">暂无顾问建议</p>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

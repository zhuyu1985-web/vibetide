"use client";

import { useState } from "react";
import type { KnowledgeSource } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Globe,
  BookOpen,
  Sparkles,
  ClipboardCheck,
  Rocket,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  knowledgeSources: {
    upload: KnowledgeSource[];
    cms: KnowledgeSource[];
    subscription: KnowledgeSource[];
    stats: { totalDocuments: number; totalChunks: number; lastSync: string };
  };
}

// ---------------------------------------------------------------------------
// UI constants
// ---------------------------------------------------------------------------

const steps = [
  { icon: Globe, label: "了解频道", desc: "分析目标频道的风格和受众" },
  { icon: BookOpen, label: "学习知识", desc: "导入行业知识和案例" },
  { icon: Sparkles, label: "塑造性格", desc: "定义顾问的个性和说话风格" },
  { icon: ClipboardCheck, label: "试岗测试", desc: "用真实场景测试输出质量" },
  { icon: Rocket, label: "正式上岗", desc: "部署到频道开始工作" },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function CreateAdvisorClient({ knowledgeSources }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="max-w-[800px] mx-auto">
      <PageHeader
        title="培养新顾问"
        description="5步流程，打造专属频道顾问"
      />

      {/* Step Progress */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  i === currentStep
                    ? "bg-blue-500 text-white"
                    : i < currentStep
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                }`}
              >
                {i < currentStep ? <Check size={18} /> : <Icon size={18} />}
              </div>
              <span
                className={`text-[10px] text-center ${
                  i === currentStep
                    ? "font-medium text-gray-800 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <GlassCard className="min-h-[300px]">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
          {steps[currentStep].label}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {steps[currentStep].desc}
        </p>

        {currentStep === 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                目标频道
              </label>
              <div className="flex gap-2 flex-wrap">
                {["微信公众号", "抖音", "B站", "小红书", "头条号", "知乎"].map(
                  (ch) => (
                    <Badge
                      key={ch}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 transition-colors px-3 py-1"
                    >
                      {ch}
                    </Badge>
                  )
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                频道定位
              </label>
              <input
                type="text"
                placeholder="例如：科技深度分析、生活方式分享、财经快讯..."
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                目标受众
              </label>
              <input
                type="text"
                placeholder="例如：25-35岁科技爱好者、一线城市白领..."
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              上传或导入频道相关的知识材料，帮助顾问深入了解行业背景。
            </p>
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
              <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">拖拽文件到此处，或点击上传</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                支持 PDF、Word、Markdown 格式
              </p>
              <Button variant="outline" size="sm" className="mt-3 text-xs">
                选择文件
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                顾问名称
              </label>
              <input
                type="text"
                placeholder="给你的顾问取个名字"
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                性格描述
              </label>
              <textarea
                placeholder="描述顾问的性格特点，例如：理性严谨、善于分析..."
                className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                说话风格
              </label>
              <div className="flex gap-2 flex-wrap">
                {["严谨专业", "轻松幽默", "温暖亲切", "犀利直接", "理性分析", "故事化叙事"].map(
                  (style) => (
                    <Badge
                      key={style}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 transition-colors px-3 py-1"
                    >
                      {style}
                    </Badge>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              用真实场景测试顾问的输出质量，确保风格和质量达标。
            </p>
            <GlassCard variant="blue" padding="sm">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                测试场景
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                请为以下热点撰写一条200字的微信公众号推送摘要：
                「AI手机大战：华为、苹果、三星三方角力」
              </p>
            </GlassCard>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">顾问输出预览</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                等待生成中...
              </p>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Rocket size={28} className="text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
              准备上岗！
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              顾问已完成培养流程，确认后将正式上岗工作。
            </p>
            <Button>
              <Check size={14} className="mr-1" />
              确认上岗
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ArrowLeft size={16} className="mr-1" />
          上一步
        </Button>
        {currentStep < 4 && (
          <Button onClick={() => setCurrentStep(currentStep + 1)}>
            下一步
            <ArrowRight size={16} className="ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

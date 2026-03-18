"use client";

import { useState, useRef, useEffect, useId } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Send,
  Search,
  Film,
  Image as ImageIcon,
  FileText,
  Clock,
  Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  searchResults?: SearchResultCard[];
}

interface SearchResultCard {
  id: string;
  title: string;
  type: "video" | "image" | "audio" | "document";
  duration?: string;
  tags: string[];
  matchScore: number;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Mock search data
// ---------------------------------------------------------------------------

const mockAssets: SearchResultCard[] = [
  {
    id: "a1",
    title: "北京冬奥会开幕式全程回顾",
    type: "video",
    duration: "03:42:00",
    tags: ["冬奥会", "北京", "体育赛事", "开幕式"],
    matchScore: 96,
    snippet:
      "2022年北京冬奥会开幕式精彩回顾，包含点火仪式、各国代表团入场等完整内容。",
  },
  {
    id: "a2",
    title: "冬奥会短道速滑500米决赛",
    type: "video",
    duration: "00:18:30",
    tags: ["冬奥会", "短道速滑", "金牌", "比赛"],
    matchScore: 88,
    snippet: "短道速滑500米决赛精彩瞬间，中国选手夺金时刻。",
  },
  {
    id: "a3",
    title: "冬奥会冰墩墩设计专访",
    type: "video",
    duration: "00:12:45",
    tags: ["冬奥会", "冰墩墩", "设计", "专访"],
    matchScore: 72,
    snippet: "专访冰墩墩设计团队，了解吉祥物背后的故事。",
  },
  {
    id: "a4",
    title: "人物采访：院士谈AI发展",
    type: "video",
    duration: "00:25:00",
    tags: ["人物采访", "AI", "院士", "科技"],
    matchScore: 94,
    snippet: "中国工程院院士深度解读人工智能产业发展趋势。",
  },
  {
    id: "a5",
    title: "企业家专访：数字化转型之路",
    type: "video",
    duration: "00:30:15",
    tags: ["人物采访", "企业家", "数字化", "转型"],
    matchScore: 85,
    snippet: "知名企业家分享数字化转型中的挑战与机遇。",
  },
  {
    id: "a6",
    title: "上周新闻素材合集",
    type: "document",
    tags: ["新闻素材", "合集", "一周回顾"],
    matchScore: 78,
    snippet: "本周重要新闻事件素材汇总，包含文字稿和配图。",
  },
  {
    id: "a7",
    title: "突发新闻：台风登陆广东",
    type: "video",
    duration: "00:05:30",
    tags: ["突发新闻", "台风", "广东", "天气"],
    matchScore: 82,
    snippet: "台风实时追踪报道，现场记者连线画面。",
  },
  {
    id: "a8",
    title: "春节庆祝活动航拍素材",
    type: "image",
    tags: ["春节", "航拍", "庆祝", "传统文化"],
    matchScore: 70,
    snippet: "全国各地春节庆祝活动航拍高清素材集。",
  },
];

const suggestedQueries = [
  "查找关于北京冬奥会的视频片段",
  "有哪些人物采访素材",
  "最近一周的新闻素材",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function searchAssets(query: string): SearchResultCard[] {
  const q = query.toLowerCase();
  return mockAssets
    .filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.snippet.toLowerCase().includes(q)
    )
    .sort((a, b) => b.matchScore - a.matchScore);
}

function generateAIResponse(query: string, results: SearchResultCard[]): string {
  if (results.length === 0) {
    return `抱歉，没有找到与"${query}"相关的素材。您可以尝试更换关键词或缩小搜索范围。`;
  }
  return `为您找到 ${results.length} 个与"${query}"相关的素材，已按相关度排序。其中匹配度最高的是"${results[0].title}"（${results[0].matchScore}%匹配）。`;
}

const typeIcons: Record<string, React.ReactNode> = {
  video: <Film size={14} className="text-blue-500" />,
  image: <ImageIcon size={14} className="text-green-500" />,
  audio: <Film size={14} className="text-purple-500" />,
  document: <FileText size={14} className="text-amber-500" />,
};

const typeLabels: Record<string, string> = {
  video: "视频",
  image: "图片",
  audio: "音频",
  document: "文档",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssetChat() {
  const componentId = useId();
  const msgCounterRef = useRef(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      content:
        "您好！我是小资，您的素材管家。我可以帮您搜索和查找媒资库中的各类素材。请输入您想查找的内容，或点击下方推荐查询试试。",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function nextMsgId(prefix: string) {
    msgCounterRef.current += 1;
    return `${prefix}-${componentId}-${msgCounterRef.current}`;
  }

  function handleSend(query?: string) {
    const q = query || input.trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: nextMsgId("user"),
      role: "user",
      content: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const results = searchAssets(q);
      const aiContent = generateAIResponse(q, results);

      const aiMsg: ChatMessage = {
        id: nextMsgId("ai"),
        role: "ai",
        content: aiContent,
        timestamp: new Date().toISOString(),
        searchResults: results,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 800);
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {msg.role === "ai" ? (
              <EmployeeAvatar employeeId="xiaozi" size="sm" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                我
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%]",
                msg.role === "user" ? "items-end" : "items-start"
              )}
            >
              <GlassCard
                padding="sm"
                variant={msg.role === "user" ? "blue" : "default"}
                className={cn(
                  "text-sm text-gray-700 dark:text-gray-300",
                  msg.role === "user" && "bg-blue-50 dark:bg-blue-950/50"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </GlassCard>

              {/* Search result cards */}
              {msg.searchResults && msg.searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-3 rounded-lg bg-white/80 dark:bg-gray-900/80 border border-gray-100 dark:border-gray-700/50 hover:border-blue-200 dark:hover:border-blue-700/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                          {typeIcons[result.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                              {result.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] shrink-0"
                            >
                              {typeLabels[result.type]}
                            </Badge>
                            <Badge className="text-[9px] bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 shrink-0">
                              {result.matchScore}%
                            </Badge>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mb-1.5">
                            {result.snippet}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {result.duration && (
                              <Badge
                                variant="outline"
                                className="text-[9px] py-0"
                              >
                                <Clock size={8} className="mr-0.5" />
                                {result.duration}
                              </Badge>
                            )}
                            {result.tags.slice(0, 3).map((tag, i) => (
                              <Badge
                                key={i}
                                className="text-[9px] py-0 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                {new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <EmployeeAvatar employeeId="xiaozi" size="sm" />
            <GlassCard padding="sm" className="text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Sparkles size={12} className="animate-pulse text-green-500" />
                <span>小资正在搜索中...</span>
              </div>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Suggested queries */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">推荐查询：</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Search size={10} className="inline mr-1" />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="描述您想查找的素材..."
              className="w-full h-9 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 transition-colors"
            />
          </div>
          <Button
            size="sm"
            className="h-9 px-4"
            disabled={!input.trim() || isTyping}
            onClick={() => handleSend()}
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

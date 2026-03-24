"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ActionsMenuProps {
  articleId: string;
  articleUrl?: string;
  onClose: () => void;
}

interface MenuItemProps {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ label, icon, onClick, danger }: MenuItemProps) {
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={cn(
        "px-3 py-2 text-xs cursor-pointer flex items-center gap-2 select-none transition-colors",
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-foreground hover:bg-muted/50"
      )}
    >
      {icon && <span className="w-4 text-center">{icon}</span>}
      <span>{label}</span>
    </div>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="px-3 py-1 text-[10px] text-muted-foreground">{label}</div>
  );
}

function Separator() {
  return <div className="h-px bg-border my-1" />;
}

export function ActionsMenu({ articleId: _articleId, articleUrl, onClose }: ActionsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function showToast(msg: string) {
    // Lightweight inline toast — avoids a full toast dependency
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:hsl(var(--popover));border:1px solid hsl(var(--border));color:hsl(var(--foreground));padding:8px 16px;border-radius:8px;font-size:12px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.15);pointer-events:none;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  function handleCopyUrl() {
    if (articleUrl) {
      navigator.clipboard.writeText(articleUrl).then(() => showToast("链接已复制"));
    } else {
      showToast("暂无原始链接");
    }
    onClose();
  }

  function handleOpenUrl() {
    if (articleUrl) {
      window.open(articleUrl, "_blank", "noopener,noreferrer");
    } else {
      showToast("暂无原始链接");
    }
    onClose();
  }

  function handleCopyText() {
    const bodyEl = document.querySelector("[data-article-body]");
    const text = bodyEl ? bodyEl.textContent ?? "" : document.body.innerText;
    navigator.clipboard.writeText(text).then(() => showToast("纯文本已复制"));
    onClose();
  }

  function handleCopyAsQuote() {
    const bodyEl = document.querySelector("[data-article-body]");
    const text = (bodyEl ? bodyEl.textContent ?? "" : "").slice(0, 200);
    const dateStr = new Date().toLocaleDateString("zh-CN");
    const quote = `> ${text}${text.length >= 200 ? "…" : ""}\n>\n> [来源](${articleUrl ?? ""}) （访问于 ${dateStr}）`;
    navigator.clipboard.writeText(quote).then(() => showToast("引用格式已复制"));
    onClose();
  }

  function handlePlaceholder(action: string) {
    showToast(`${action} — 即将支持`);
    onClose();
  }

  function handleDelete() {
    if (window.confirm("确定要删除这篇稿件吗？此操作不可撤销。")) {
      showToast("删除功能即将支持");
    }
    onClose();
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl w-[220px] py-1"
    >
      <GroupLabel label="分享与访问" />
      <MenuItem label="分享阅读" icon="🔗" onClick={() => handlePlaceholder("分享阅读")} />
      <MenuItem label="访问原始网页" icon="🌐" onClick={handleOpenUrl} />
      <MenuItem label="更新/保存快照" icon="📸" onClick={() => handlePlaceholder("保存快照")} />

      <Separator />

      <GroupLabel label="复制" />
      <MenuItem label="复制原链接" icon="🔗" onClick={handleCopyUrl} />
      <MenuItem label="复制纯文本" icon="📄" onClick={handleCopyText} />
      <MenuItem label="复制 Markdown" icon="📝" onClick={() => handlePlaceholder("复制 Markdown")} />
      <MenuItem label="复制为引用" icon="💬" onClick={handleCopyAsQuote} />

      <Separator />

      <GroupLabel label="导出" />
      <MenuItem label="导出 PDF" icon="📑" onClick={() => handlePlaceholder("导出 PDF")} />
      <MenuItem label="导出 Markdown" icon="📝" onClick={() => handlePlaceholder("导出 Markdown")} />
      <MenuItem label="导出 TXT" icon="📄" onClick={() => handlePlaceholder("导出 TXT")} />

      <Separator />

      <GroupLabel label="整理" />
      <MenuItem label="设为星标 ⭐" icon="⭐" onClick={() => handlePlaceholder("星标")} />
      <MenuItem label="编辑元信息" icon="✏️" onClick={() => handlePlaceholder("编辑元信息")} />
      <MenuItem label="归档" icon="📦" onClick={() => handlePlaceholder("归档")} />
      <MenuItem label="删除" icon="🗑️" onClick={handleDelete} danger />
    </div>
  );
}

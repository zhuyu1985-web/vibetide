"use client";

import {
  Share2, Download, Pencil, Globe, GlobeLock, Wand2, FolderInput,
  Trash2, ArrowRightLeft, ClipboardCheck, Link, Copy,
} from "lucide-react";
import type { MediaLibraryType } from "@/lib/types";

export interface ContextMenuItem {
  key: string;
  label: string;
  icon: typeof Share2;
  danger?: boolean;
}

export function getContextMenuItems(library: MediaLibraryType, isPublic?: boolean): ContextMenuItem[] {
  if (library === "personal") {
    return [
      { key: "share", label: "分享", icon: Share2 },
      { key: "download", label: "下载", icon: Download },
      { key: "rename", label: "重命名", icon: Pencil },
      { key: "togglePublic", label: isPublic ? "取消公开" : "公开", icon: isPublic ? GlobeLock : Globe },
      { key: "smartProcess", label: "智能处理", icon: Wand2 },
      { key: "moveToProduct", label: "入成品库", icon: FolderInput },
      { key: "copyLink", label: "复制链接", icon: Link },
      { key: "delete", label: "删除", icon: Trash2, danger: true },
    ];
  }

  if (library === "product") {
    return [
      { key: "share", label: "分享", icon: Share2 },
      { key: "download", label: "下载", icon: Download },
      { key: "rename", label: "重命名", icon: Pencil },
      { key: "smartProcess", label: "智能处理", icon: Wand2 },
      { key: "submitReview", label: "提交审核", icon: ClipboardCheck },
      { key: "move", label: "移动", icon: ArrowRightLeft },
      { key: "copyLink", label: "复制链接", icon: Link },
      { key: "delete", label: "删除", icon: Trash2, danger: true },
    ];
  }

  if (library === "public") {
    return [
      { key: "download", label: "下载", icon: Download },
      { key: "copyLink", label: "复制链接", icon: Copy },
    ];
  }

  if (library === "recycle") {
    return [
      { key: "restore", label: "还原", icon: FolderInput },
      { key: "permanentDelete", label: "彻底删除", icon: Trash2, danger: true },
    ];
  }

  return [];
}

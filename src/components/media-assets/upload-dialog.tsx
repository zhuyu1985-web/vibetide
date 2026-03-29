"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, File, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmUpload } from "@/app/actions/assets";
import type { MediaAssetType, SecurityLevel } from "@/lib/types";

interface UploadItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  status: "pending" | "uploading" | "uploaded" | "failed";
  progress: number;
  objectKey?: string;
  error?: string;
}

const securityLevels: { value: SecurityLevel; label: string }[] = [
  { value: "public", label: "公开" },
  { value: "secret", label: "秘密" },
  { value: "private", label: "不公开" },
  { value: "top_secret", label: "绝密" },
  { value: "confidential", label: "机密" },
];

function guessMediaType(mimeType: string): MediaAssetType {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryType: "personal" | "product";
  categoryId?: string;
}

export function UploadDialog({ open, onOpenChange, libraryType, categoryId }: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>("public");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      fileSize: file.size,
      status: "pending" as const,
      progress: 0,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const uploadAll = async () => {
    setUploading(true);
    const pending = items.filter((i) => i.status === "pending");

    for (const item of pending) {
      try {
        // 1. Get presigned URL
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: "uploading", progress: 10 } : i));

        const res = await fetch("/api/media-assets/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: item.fileName,
            contentType: item.file.type || "application/octet-stream",
            fileSize: item.fileSize,
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, objectKey, bucket } = await res.json();

        // 2. Upload to TOS
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, progress: 30 } : i));

        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round(30 + (e.loaded / e.total) * 60);
              setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, progress: pct } : i));
            }
          };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
          xhr.send(item.file);
        });

        // 3. Confirm upload in DB
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, progress: 95 } : i));

        await confirmUpload({
          title: item.fileName.replace(/\.[^.]+$/, ""),
          type: guessMediaType(item.file.type),
          fileName: item.fileName,
          fileSize: item.fileSize,
          mimeType: item.file.type || "application/octet-stream",
          tosObjectKey: objectKey,
          tosBucket: bucket,
          libraryType,
          categoryId,
          securityLevel,
        });

        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: "uploaded", progress: 100, objectKey } : i));
      } catch (err) {
        setItems((prev) => prev.map((i) =>
          i.id === item.id ? { ...i, status: "failed", error: err instanceof Error ? err.message : "上传失败" } : i
        ));
      }
    }
    setUploading(false);
  };

  const allDone = items.length > 0 && items.every((i) => i.status === "uploaded" || i.status === "failed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] glass-panel">
        <DialogHeader>
          <DialogTitle>上传资源</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        >
          <Upload size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="text-[13px] text-gray-500 dark:text-gray-400">点击或拖拽文件到此区域</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">支持视频、音频、图片、文档</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* Config */}
        <div className="flex items-center gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">密级:</span>
            <select
              value={securityLevel}
              onChange={(e) => setSecurityLevel(e.target.value as SecurityLevel)}
              className="h-7 px-2 rounded-md bg-gray-100 dark:bg-white/5 text-[12px] outline-none"
            >
              {securityLevels.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* File list */}
        {items.length > 0 && (
          <div className="max-h-[240px] overflow-y-auto space-y-1.5">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
                <File size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-gray-700 dark:text-gray-300 truncate">{item.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          item.status === "failed" ? "bg-red-500" : item.status === "uploaded" ? "bg-green-500" : "bg-blue-500"
                        )}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0 w-8">{formatSize(item.fileSize)}</span>
                  </div>
                </div>
                {item.status === "uploaded" && <CheckCircle size={16} className="text-green-500 shrink-0" />}
                {item.status === "failed" && <AlertCircle size={16} className="text-red-500 shrink-0" />}
                {item.status === "uploading" && <Loader2 size={16} className="text-blue-500 shrink-0 animate-spin" />}
                {item.status === "pending" && (
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => { setItems([]); onOpenChange(false); }}
            className="h-8 px-4 rounded-lg text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            {allDone ? "关闭" : "取消"}
          </button>
          {!allDone && items.length > 0 && (
            <button
              onClick={uploadAll}
              disabled={uploading || items.filter((i) => i.status === "pending").length === 0}
              className="h-8 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? "上传中..." : "开始上传"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

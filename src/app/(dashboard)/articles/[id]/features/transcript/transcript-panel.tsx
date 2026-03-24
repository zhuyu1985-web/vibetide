"use client";
import { useRef, useEffect, useCallback } from "react";
import { Download } from "lucide-react";
import { useTranscript } from "./use-transcript";
import { TranscriptSegmentItem } from "./transcript-segment";
import type { TranscriptSegment } from "../../types";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export function TranscriptPanel({ segments, currentTime, onSeek }: TranscriptPanelProps) {
  const {
    activeSegmentId,
    getSpeakerName,
    correctText,
    getDisplayText,
    exportSRT,
    exportTXT,
  } = useTranscript(segments, currentTime);

  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll to keep the active segment visible
  useEffect(() => {
    if (!activeSegmentId) return;
    const el = segmentRefs.current[activeSegmentId];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeSegmentId]);

  const handleExportSRT = useCallback(() => {
    const content = exportSRT();
    triggerDownload(content, "transcript.srt", "text/plain;charset=utf-8");
  }, [exportSRT]);

  const handleExportTXT = useCallback(() => {
    const content = exportTXT();
    triggerDownload(content, "transcript.txt", "text/plain;charset=utf-8");
  }, [exportTXT]);

  if (segments.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-xs text-white/30">暂无听记数据</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Segment list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto min-h-0 space-y-0.5 pr-1"
      >
        {segments.map((segment) => (
          <div
            key={segment.id}
            ref={(el) => { segmentRefs.current[segment.id] = el; }}
          >
            <TranscriptSegmentItem
              segment={segment}
              displayText={getDisplayText(segment)}
              speakerName={getSpeakerName(segment.speaker)}
              isActive={segment.id === activeSegmentId}
              onClickTimestamp={onSeek}
              onCorrectText={(text) => correctText(segment.id, text)}
            />
          </div>
        ))}
      </div>

      {/* Export buttons */}
      <div className="flex items-center gap-3 pt-2 mt-2 border-t border-white/5 shrink-0">
        <Download className="w-3 h-3 text-white/30 shrink-0" />
        <button
          type="button"
          onClick={handleExportSRT}
          className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
        >
          导出 SRT
        </button>
        <span className="text-white/20 text-[10px]">|</span>
        <button
          type="button"
          onClick={handleExportTXT}
          className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
        >
          导出 TXT
        </button>
      </div>
    </div>
  );
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

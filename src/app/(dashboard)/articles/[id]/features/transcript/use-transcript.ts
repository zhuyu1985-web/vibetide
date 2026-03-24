"use client";
import { useState, useCallback, useMemo } from "react";
import type { TranscriptSegment } from "../../types";

export function useTranscript(segments: TranscriptSegment[], currentTime: number) {
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});

  // Find the currently active segment based on currentTime
  const activeSegmentId = useMemo(() => {
    const active = segments.find(s => currentTime >= s.startTime && currentTime < s.endTime);
    return active?.id ?? null;
  }, [segments, currentTime]);

  // Get display name for a speaker (user-renamed or original)
  const getSpeakerName = useCallback((speaker: string) => {
    return speakerNames[speaker] ?? speaker;
  }, [speakerNames]);

  // Rename a speaker globally
  const renameSpeaker = useCallback((originalName: string, newName: string) => {
    setSpeakerNames(prev => ({ ...prev, [originalName]: newName }));
  }, []);

  // Correct a segment's text (for ASR error correction)
  const correctText = useCallback((segmentId: string, correctedText: string) => {
    setCorrections(prev => ({ ...prev, [segmentId]: correctedText }));
  }, []);

  // Get the display text for a segment (corrected or original)
  const getDisplayText = useCallback((segment: TranscriptSegment) => {
    return corrections[segment.id] ?? segment.correctedText ?? segment.text;
  }, [corrections]);

  // Export as SRT
  const exportSRT = useCallback(() => {
    return segments.map((s, i) => {
      const start = formatSRTTime(s.startTime);
      const end = formatSRTTime(s.endTime);
      const text = corrections[s.id] ?? s.correctedText ?? s.text;
      return `${i + 1}\n${start} --> ${end}\n${text}\n`;
    }).join("\n");
  }, [segments, corrections]);

  // Export as plain text
  const exportTXT = useCallback(() => {
    return segments.map(s => {
      const name = getSpeakerName(s.speaker);
      const text = corrections[s.id] ?? s.correctedText ?? s.text;
      return `[${formatTime(s.startTime)}] ${name}: ${text}`;
    }).join("\n");
  }, [segments, corrections, getSpeakerName]);

  return {
    activeSegmentId, getSpeakerName, renameSpeaker,
    correctText, getDisplayText, exportSRT, exportTXT,
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

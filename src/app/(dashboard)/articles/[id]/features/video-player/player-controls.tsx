"use client";

import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Camera,
  PictureInPicture2,
  Repeat,
  Captions,
  SkipBack,
  SkipForward,
} from "lucide-react";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isMuted: boolean;
  loopRange: { start: number; end: number } | null;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSkip: (seconds: number) => void;
  onChangeRate: (rate: number) => void;
  onToggleMute: () => void;
  onCapture: () => void;
  onTogglePiP: () => void;
  onToggleLoop: () => void;
}

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  isMuted,
  loopRange,
  onTogglePlay,
  onSeek: _onSeek,
  onSkip,
  onChangeRate,
  onToggleMute,
  onCapture,
  onTogglePiP,
  onToggleLoop,
}: PlayerControlsProps) {
  const cycleRate = () => {
    const idx = PLAYBACK_RATES.indexOf(playbackRate);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    onChangeRate(next);
  };

  const iconBtn = "p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors";

  return (
    <div className="flex items-center justify-between px-3 py-1.5 gap-2">
      {/* Left group: play + time + skip + volume */}
      <div className="flex items-center gap-1">
        <button
          className={iconBtn}
          onClick={() => onSkip(-10)}
          title="后退10秒"
          aria-label="后退10秒"
        >
          <SkipBack size={15} />
        </button>

        <button
          className={iconBtn}
          onClick={onTogglePlay}
          title={isPlaying ? "暂停" : "播放"}
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          className={iconBtn}
          onClick={() => onSkip(10)}
          title="前进10秒"
          aria-label="前进10秒"
        >
          <SkipForward size={15} />
        </button>

        <span className="text-xs tabular-nums text-muted-foreground select-none ml-1">
          {formatTime(currentTime)}
          <span className="mx-0.5 opacity-50">/</span>
          {formatTime(duration)}
        </span>

        <button
          className={iconBtn}
          onClick={onToggleMute}
          title={isMuted ? "取消静音" : "静音"}
          aria-label={isMuted ? "取消静音" : "静音"}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>

      {/* Right group: rate + capture + PiP + loop + CC */}
      <div className="flex items-center gap-0.5">
        {/* Playback rate cycle */}
        <button
          className={cn(
            iconBtn,
            "text-xs font-medium tabular-nums min-w-[3rem] text-center"
          )}
          onClick={cycleRate}
          title="切换倍速"
          aria-label="切换倍速"
        >
          {playbackRate === 1 ? "1x" : `${playbackRate}x`}
        </button>

        {/* Capture frame */}
        <button
          className={iconBtn}
          onClick={onCapture}
          title="截取当前帧"
          aria-label="截取当前帧"
        >
          <Camera size={15} />
        </button>

        {/* Picture in Picture */}
        <button
          className={iconBtn}
          onClick={onTogglePiP}
          title="画中画"
          aria-label="画中画"
        >
          <PictureInPicture2 size={15} />
        </button>

        {/* Loop */}
        <button
          className={cn(iconBtn, loopRange ? "text-orange-400 hover:text-orange-300" : "")}
          onClick={onToggleLoop}
          title={loopRange ? "取消循环" : "设置循环片段"}
          aria-label={loopRange ? "取消循环" : "设置循环片段"}
        >
          <Repeat size={15} />
        </button>

        {/* Captions / CC */}
        <button
          className={iconBtn}
          title="字幕"
          aria-label="字幕"
        >
          <Captions size={15} />
        </button>
      </div>
    </div>
  );
}

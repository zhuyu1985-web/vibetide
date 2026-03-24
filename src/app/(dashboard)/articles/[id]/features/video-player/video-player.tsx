"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVideoPlayer } from "./use-video-player";
import { PlayerControls } from "./player-controls";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  videoUrl: string;
  onTimeUpdate?: (time: number) => void;
}

export function VideoPlayer({ videoUrl, onTimeUpdate }: VideoPlayerProps) {
  const {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    isMuted,
    playbackRate,
    loopRange,
    togglePlay,
    seek,
    skip,
    toggleMute,
    changeRate,
    togglePiP,
    captureFrame,
    setLoopRange,
  } = useVideoPlayer();

  // Notify parent of time updates
  useEffect(() => {
    onTimeUpdate?.(currentTime);
  }, [currentTime, onTimeUpdate]);

  // Aspect ratio detection: track video natural dimensions
  const [isVertical, setIsVertical] = useState(false);
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsVertical(video.videoHeight > video.videoWidth);
  }, [videoRef]);

  // Progress bar interaction
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getTimeFromPointer = useCallback(
    (clientX: number): number => {
      const bar = progressRef.current;
      if (!bar || !duration) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seek(getTimeFromPointer(e.clientX));
    },
    [seek, getTimeFromPointer]
  );

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      seek(getTimeFromPointer(e.clientX));
    },
    [seek, getTimeFromPointer]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => seek(getTimeFromPointer(e.clientX));
    const onMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, seek, getTimeFromPointer]);

  // Capture: download as PNG
  const handleCapture = useCallback(() => {
    const dataUrl = captureFrame();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `frame-${Math.floor(currentTime)}s.png`;
    a.click();
  }, [captureFrame, currentTime]);

  // Loop toggle: set loop between last 30s segment or clear
  const handleToggleLoop = useCallback(() => {
    if (loopRange) {
      setLoopRange(null);
    } else {
      const start = Math.max(0, currentTime - 15);
      const end = Math.min(duration || currentTime + 15, currentTime + 15);
      setLoopRange({ start, end });
    }
  }, [loopRange, setLoopRange, currentTime, duration]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex flex-col w-full bg-black rounded-lg overflow-hidden">
      {/* Video element */}
      <div
        className={cn(
          "relative w-full bg-black flex items-center justify-center",
          isVertical ? "max-h-[60vh]" : "aspect-video"
        )}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onClick={togglePlay}
          className={cn(
            "cursor-pointer",
            isVertical
              ? "h-full w-auto max-h-[60vh]"
              : "w-full h-full object-contain"
          )}
        />

        {/* Subtitle overlay placeholder */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
          {/* Subtitles will be injected here in a future task */}
        </div>
      </div>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="relative h-1.5 bg-white/10 cursor-pointer group mx-0"
        onClick={handleProgressClick}
        onMouseDown={handleProgressMouseDown}
        role="slider"
        aria-label="视频进度"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") skip(-5);
          if (e.key === "ArrowRight") skip(5);
        }}
      >
        {/* Background track */}
        <div className="absolute inset-0 bg-white/10" />

        {/* Loop range marker */}
        {loopRange && duration > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-orange-400/30"
            style={{
              left: `${(loopRange.start / duration) * 100}%`,
              width: `${((loopRange.end - loopRange.start) / duration) * 100}%`,
            }}
          />
        )}

        {/* Filled progress */}
        <div
          className="absolute top-0 left-0 bottom-0 bg-blue-500 transition-none"
          style={{ width: `${progress * 100}%` }}
        />

        {/* Scrubber thumb */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow transition-opacity",
            isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          style={{ left: `${progress * 100}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>

      {/* Controls */}
      <PlayerControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        isMuted={isMuted}
        loopRange={loopRange}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onSkip={skip}
        onChangeRate={changeRate}
        onToggleMute={toggleMute}
        onCapture={handleCapture}
        onTogglePiP={togglePiP}
        onToggleLoop={handleToggleLoop}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useInView,
  animate,
} from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

function MotionNumber({
  value,
  duration,
}: {
  value: number;
  duration: number;
}) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) =>
    Math.round(latest).toLocaleString()
  );
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    // Reset to 0 before animating
    motionValue.set(0);
    const controls = animate(motionValue, value, {
      duration,
      ease: "easeOut",
    });

    const unsubscribe = rounded.on("change", (latest) => {
      setDisplayValue(latest);
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [motionValue, rounded, value, duration]);

  return <span>{displayValue}</span>;
}

export function AnimatedCounter({
  value,
  suffix,
  duration = 2,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: false, margin: "-50px" });
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (isInView) {
      // Increment key to force remount of MotionNumber, restarting the animation
      setAnimationKey((k) => k + 1);
    }
  }, [isInView]);

  return (
    <span ref={ref} className={cn("inline-flex items-baseline", className)}>
      {isInView ? (
        <MotionNumber key={animationKey} value={value} duration={duration} />
      ) : (
        <span>0</span>
      )}
      {suffix && (
        <motion.span
          key={`suffix-${animationKey}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={
            isInView
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0 }
          }
          transition={{
            delay: duration,
            duration: 0.3,
            type: "spring",
            stiffness: 300,
            damping: 15,
          }}
          className="ml-0.5"
        >
          {suffix}
        </motion.span>
      )}
    </span>
  );
}

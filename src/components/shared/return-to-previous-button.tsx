"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RETURN_TO_PARAM, getSafeReturnTo } from "@/lib/navigation-return";

type ButtonProps = React.ComponentProps<typeof Button>;

interface ReturnToPreviousButtonProps {
  fallbackHref?: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

export function ReturnToPreviousButton({
  fallbackHref = "/home",
  label = "返回",
  variant = "ghost",
  size = "sm",
  className,
}: ReturnToPreviousButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClick() {
    const returnHref = getSafeReturnTo(searchParams, fallbackHref);
    if (searchParams.get(RETURN_TO_PARAM) !== null) {
      router.push(returnHref);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(returnHref);
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <ArrowLeft className="mr-1 size-4" />
      {label}
    </Button>
  );
}

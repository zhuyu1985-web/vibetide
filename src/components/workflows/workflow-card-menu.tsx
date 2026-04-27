"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Copy, Pin, PinOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface WorkflowCardMenuProps {
  templateId: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export function WorkflowCardMenu({
  templateId,
  isPinned,
  onTogglePin,
}: WorkflowCardMenuProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="工作流操作菜单"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onClick={() => router.push(`/workflows/${templateId}`)}
        >
          <Pencil size={14} className="mr-2" />
          编辑工作流
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            router.push(`/scenarios/customize?from=${templateId}`)
          }
        >
          <Copy size={14} className="mr-2" />
          复制为我的工作流
        </DropdownMenuItem>
        {onTogglePin && (
          <DropdownMenuItem onClick={onTogglePin}>
            {isPinned ? (
              <PinOff size={14} className="mr-2" />
            ) : (
              <Pin size={14} className="mr-2" />
            )}
            {isPinned ? "取消置顶" : "置顶"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

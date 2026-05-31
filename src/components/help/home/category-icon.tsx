import {
  Rocket, Bot, Workflow, PenLine, Database, FolderOpen, Radio, Settings, type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Rocket, Bot, Workflow, PenLine, Database, FolderOpen, Radio, Settings,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? FolderOpen;
  return <Icon className={className} />;
}

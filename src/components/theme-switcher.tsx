"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themeOptions = [
  { value: "light", label: "亮色模式", icon: Sun },
  { value: "dark", label: "暗色模式", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <Monitor size={16} className="text-muted-foreground" />
      </Button>
    );
  }

  const currentIcon =
    theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const CurrentIcon = currentIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <CurrentIcon size={16} className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={theme === option.value ? "bg-accent" : ""}
            >
              <Icon size={14} className="mr-2" />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

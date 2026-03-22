"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import type { ScenarioCardData } from "@/lib/types";

interface ScenarioFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: ScenarioCardData | null;
  onSubmit: (inputs: Record<string, string>) => void;
}

export function ScenarioFormSheet({
  open,
  onOpenChange,
  scenario,
  onSubmit,
}: ScenarioFormSheetProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});

  // Reset inputs when scenario changes
  useEffect(() => {
    if (open) {
      setInputs({});
    }
  }, [open, scenario?.id]);

  if (!scenario) return null;

  const allRequiredFilled = scenario.inputFields
    .filter((f) => f.required)
    .every((f) => inputs[f.name]?.trim());

  const handleSubmit = () => {
    if (!allRequiredFilled) return;
    onSubmit(inputs);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-[420px] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="text-base">{scenario.name}</SheetTitle>
          <SheetDescription>{scenario.description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          {scenario.inputFields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </Label>

              {field.type === "select" && field.options ? (
                <Select
                  value={inputs[field.name] || ""}
                  onValueChange={(val) =>
                    setInputs((prev) => ({ ...prev, [field.name]: val }))
                  }
                >
                  <SelectTrigger className="border-0 bg-gray-100 dark:bg-gray-800">
                    <SelectValue
                      placeholder={field.placeholder || "请选择"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea
                  className="border-0 bg-gray-100 dark:bg-gray-800 resize-none text-sm"
                  rows={3}
                  placeholder={field.placeholder}
                  value={inputs[field.name] || ""}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }))
                  }
                />
              ) : (
                <Input
                  className="border-0 bg-gray-100 dark:bg-gray-800 text-sm"
                  placeholder={field.placeholder}
                  value={inputs[field.name] || ""}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      handleSubmit();
                    }
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="pt-2 pb-2">
          <Button
            className="w-full gap-2 border-0"
            onClick={handleSubmit}
            disabled={!allRequiredFilled}
          >
            <Sparkles size={14} />
            开始执行
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

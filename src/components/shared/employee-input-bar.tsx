"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send, AtSign } from "lucide-react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { EmployeeAvatar } from "./employee-avatar";
// TODO: re-implement with mission message system
import { cn } from "@/lib/utils";

interface EmployeeInputBarProps {
  teamId?: string;
}

export function EmployeeInputBar({ teamId }: EmployeeInputBarProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const employees = useMemo(
    () => Object.values(EMPLOYEE_META).filter((e) => e.id !== "advisor"),
    []
  );

  // Filter employees based on the current @mention query
  const filteredEmployees = useMemo(() => {
    if (!mentionQuery) return employees;
    const q = mentionQuery.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.nickname.toLowerCase().includes(q) ||
        emp.name.toLowerCase().includes(q) ||
        emp.title.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q)
    );
  }, [employees, mentionQuery]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredEmployees.length]);

  // Detect @mention while typing
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);

      // Check if user just typed @ or is continuing a mention
      const cursorPos = e.target.selectionStart ?? val.length;
      const textBeforeCursor = val.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);

      if (atMatch) {
        setShowMention(true);
        setMentionQuery(atMatch[1]);
      } else {
        setShowMention(false);
        setMentionQuery("");
      }
    },
    []
  );

  // Insert mention into input
  const insertMention = useCallback(
    (emp: (typeof employees)[0]) => {
      const cursorPos = inputRef.current?.selectionStart ?? input.length;
      const textBeforeCursor = input.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);

      if (atMatch) {
        const beforeAt = textBeforeCursor.slice(
          0,
          textBeforeCursor.length - atMatch[0].length
        );
        const afterCursor = input.slice(cursorPos);
        const newVal = `${beforeAt}@${emp.nickname} ${afterCursor}`;
        setInput(newVal);
      } else {
        setInput((prev) => prev + `@${emp.nickname} `);
      }

      setShowMention(false);
      setMentionQuery("");
      inputRef.current?.focus();
    },
    [input]
  );

  // Keyboard navigation in mention dropdown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showMention && filteredEmployees.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) =>
            i < filteredEmployees.length - 1 ? i + 1 : 0
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) =>
            i > 0 ? i - 1 : filteredEmployees.length - 1
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(filteredEmployees[selectedIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowMention(false);
          setMentionQuery("");
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [showMention, filteredEmployees, selectedIndex, insertMention]
  );

  async function handleSend() {
    // TODO: re-implement with mission message system
    if (!input.trim() || !teamId) return;
    setInput("");
    setShowMention(false);
    setMentionQuery("");
    router.refresh();
  }

  return (
    <div className="relative">
      {showMention && filteredEmployees.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-72 glass-card p-2 z-50 max-h-64 overflow-y-auto shadow-lg">
          <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">
            {mentionQuery ? "匹配的AI员工" : "选择AI员工"}
          </p>
          {filteredEmployees.map((emp, idx) => (
            <button
              key={emp.id}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left",
                idx === selectedIndex
                  ? "bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-200 dark:ring-blue-700/50"
                  : "hover:bg-blue-50/60 dark:hover:bg-blue-950/30"
              )}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => insertMention(emp)}
            >
              <EmployeeAvatar employeeId={emp.id as EmployeeId} size="xs" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {emp.nickname}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {emp.title}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 glass-card p-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-400 dark:text-gray-500 hover:text-blue-500"
          onClick={() => {
            if (showMention) {
              setShowMention(false);
              setMentionQuery("");
            } else {
              // Insert @ at cursor and trigger mention
              setInput((prev) => prev + "@");
              setShowMention(true);
              setMentionQuery("");
              inputRef.current?.focus();
            }
          }}
        >
          <AtSign size={16} />
        </Button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay to allow click on mention item
            setTimeout(() => {
              setShowMention(false);
              setMentionQuery("");
            }, 200);
          }}
          placeholder={
            teamId
              ? "输入指令或 @ 提及AI员工..."
              : "请先选择一个团队..."
          }
          disabled={!teamId}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50"
        />
        <Button
          size="sm"
          className="h-8 px-3"
          disabled={!input.trim() || !teamId || sending}
          onClick={handleSend}
        >
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { addTeamMember } from "@/app/actions/teams";
import { Loader2, Bot, User } from "lucide-react";
import type { AIEmployee } from "@/lib/types";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  availableEmployees: AIEmployee[];
  existingMemberIds: string[];
}

export function AddMemberDialog({
  open,
  onOpenChange,
  teamId,
  availableEmployees,
  existingMemberIds,
}: AddMemberDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedAI, setSelectedAI] = useState<Set<string>>(new Set());
  const [humanName, setHumanName] = useState("");
  const [humanRole, setHumanRole] = useState("");

  const unassigned = availableEmployees.filter(
    (emp) => !existingMemberIds.includes(emp.id)
  );

  const toggleAI = (id: string) => {
    const next = new Set(selectedAI);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAI(next);
  };

  const handleAddAI = async () => {
    if (selectedAI.size === 0) return;
    setLoading(true);
    try {
      for (const empId of selectedAI) {
        const emp = availableEmployees.find((e) => e.id === empId);
        if (!emp) continue;
        await addTeamMember(teamId, {
          memberType: "ai",
          displayName: emp.id,
          teamRole: emp.title,
        });
      }
      setSelectedAI(new Set());
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to add AI member:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHuman = async () => {
    if (!humanName) return;
    setLoading(true);
    try {
      await addTeamMember(teamId, {
        memberType: "human",
        displayName: humanName,
        teamRole: humanRole || humanName,
      });
      setHumanName("");
      setHumanRole("");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to add human member:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加团队成员</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="ai">
          <TabsList className="mb-4">
            <TabsTrigger value="ai" className="text-xs gap-1">
              <Bot size={14} />
              AI员工
            </TabsTrigger>
            <TabsTrigger value="human" className="text-xs gap-1">
              <User size={14} />
              人类成员
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {unassigned.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                  所有AI员工已在团队中
                </p>
              ) : (
                unassigned.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-blue-50/50 dark:hover:bg-blue-950/25 transition-colors cursor-pointer"
                    onClick={() => toggleAI(emp.id)}
                  >
                    <Checkbox checked={selectedAI.has(emp.id)} />
                    <EmployeeAvatar employeeId={emp.id} size="sm" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {emp.nickname}
                      </span>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{emp.title}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handleAddAI}
                disabled={loading || selectedAI.size === 0}
              >
                {loading && <Loader2 size={14} className="mr-1 animate-spin" />}
                添加 {selectedAI.size > 0 ? `(${selectedAI.size})` : ""}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="human">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">姓名</Label>
                <Input
                  placeholder="如: 张编辑"
                  value={humanName}
                  onChange={(e) => setHumanName(e.target.value)}
                  className="glass-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">角色</Label>
                <Input
                  placeholder="如: 主编"
                  value={humanRole}
                  onChange={(e) => setHumanRole(e.target.value)}
                  className="glass-input"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handleAddHuman}
                disabled={loading || !humanName}
              >
                {loading && <Loader2 size={14} className="mr-1 animate-spin" />}
                添加成员
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

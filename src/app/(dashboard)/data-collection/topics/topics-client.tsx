"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TopicSidebar } from "./topic-sidebar";
import { TopicDetailPanel } from "./topic-detail-panel";
import { TopicEditDrawer } from "./topic-edit-drawer";
import { TopicGroupDialog } from "./topic-group-dialog";
import type { TopicSummary } from "@/lib/dal/research/research-topics";

interface TopicsClientProps {
  topics: TopicSummary[];
  groups: string[];
}

export function TopicsClient({ topics, groups }: TopicsClientProps) {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(
    topics[0]?.id ?? null,
  );
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicSummary | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  // Local override for groups list (lets newly created groups appear in sidebar
  // immediately, even before user assigns a topic to them via edit drawer).
  const [extraGroups, setExtraGroups] = useState<string[]>([]);

  // Keep selectedId valid when topics list changes after refresh.
  useEffect(() => {
    if (selectedId && topics.some((t) => t.id === selectedId)) return;
    setSelectedId(topics[0]?.id ?? null);
  }, [topics, selectedId]);

  const allGroups = useMemo(() => {
    const set = new Set<string>(groups);
    for (const g of extraGroups) set.add(g);
    return Array.from(set).sort();
  }, [groups, extraGroups]);

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedId) ?? null,
    [topics, selectedId],
  );

  function handleOpenNewTopic() {
    setEditingTopic(null);
    setEditDrawerOpen(true);
  }

  function handleEditTopic() {
    if (!selectedTopic) return;
    setEditingTopic(selectedTopic);
    setEditDrawerOpen(true);
  }

  async function handleCreateGroup(groupName: string) {
    // We don't persist empty groups server-side; they're derived from topic
    // groupName. Push into local state so the new group surfaces in the sidebar
    // / edit drawer Select; once a topic is assigned the group it becomes
    // canonical from DB.
    if (allGroups.includes(groupName)) {
      throw new Error("分组已存在");
    }
    setExtraGroups((prev) => [...prev, groupName]);
    toast.success(`分组「${groupName}」已就绪，请在创建方案时选择此分组`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">主题监测</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            管理监测方案与命中结果。左侧为方案列表(按分组组织)，右侧展示命中卡片。
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleOpenNewTopic}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          创建方案
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <TopicSidebar
          topics={topics}
          groups={allGroups}
          selectedTopicId={selectedId}
          onSelectTopic={setSelectedId}
          onOpenNewTopic={handleOpenNewTopic}
          onOpenNewGroup={() => setGroupDialogOpen(true)}
        />

        <div className="min-w-0 flex-1">
          {selectedTopic ? (
            <TopicDetailPanel topic={selectedTopic} onEdit={handleEditTopic} />
          ) : (
            <GlassCard variant="panel" padding="lg">
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  还没有监测方案，点击下方按钮创建第一个方案
                </p>
                <Button variant="ghost" size="sm" onClick={handleOpenNewTopic}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  创建方案
                </Button>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <TopicEditDrawer
        open={editDrawerOpen}
        onOpenChange={(open) => {
          setEditDrawerOpen(open);
          if (!open) {
            // After drawer close, server data may have been mutated -> router.refresh
            // (already triggered inside drawer); rely on re-render.
            router.refresh();
          }
        }}
        topic={editingTopic}
        groups={allGroups}
      />

      <TopicGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onCreate={handleCreateGroup}
      />
    </div>
  );
}

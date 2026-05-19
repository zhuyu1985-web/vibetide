"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import type { CollectedItemFilterOptions } from "@/lib/dal/collected-items";
import type { TopicSummary } from "@/lib/dal/research/research-topics";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TopicDetailPanel } from "./topic-detail-panel";
import { TopicEditDrawer } from "./topic-edit-drawer";
import { TopicGroupDialog } from "./topic-group-dialog";
import { TopicSidebar } from "./topic-sidebar";

interface TopicsClientProps {
  topics: TopicSummary[];
  groups: string[];
  adapterMetas: AdapterMeta[];
  outlets: MediaOutletRow[];
  filterOptions: CollectedItemFilterOptions;
}

export function TopicsClient({
  topics,
  groups,
  adapterMetas,
  outlets,
  filterOptions,
}: TopicsClientProps) {
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

  const allGroups = useMemo(() => {
    const set = new Set<string>(groups);
    for (const g of extraGroups) set.add(g);
    return Array.from(set).sort();
  }, [groups, extraGroups]);

  const effectiveSelectedId =
    selectedId && topics.some((t) => t.id === selectedId)
      ? selectedId
      : (topics[0]?.id ?? null);

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === effectiveSelectedId) ?? null,
    [topics, effectiveSelectedId],
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

  function handleEditTopicById(topicId: string) {
    const target = topics.find((t) => t.id === topicId);
    if (!target) return;
    setSelectedId(topicId);
    setEditingTopic(target);
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
    <div className="min-h-0">
      <div className="flex items-start gap-4">
        <div className="sticky top-4 flex w-[280px] shrink-0 flex-col gap-4 self-start">
          <div className="min-h-[45px]">
            <h2 className="text-xl font-semibold text-foreground">主题词</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              按分组管理监测主题词，快速切换预置方案
            </p>
          </div>

          <TopicSidebar
            topics={topics}
            groups={allGroups}
            selectedTopicId={effectiveSelectedId}
            onSelectTopic={setSelectedId}
            onEditTopic={handleEditTopicById}
            onOpenNewTopic={handleOpenNewTopic}
            onOpenNewGroup={() => setGroupDialogOpen(true)}
          />
        </div>

        <div className="min-w-0 flex-1">
          {selectedTopic ? (
            <TopicDetailPanel
              topic={selectedTopic}
              onEdit={handleEditTopic}
              adapterMetas={adapterMetas}
              outlets={outlets}
              filterOptions={filterOptions}
            />
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

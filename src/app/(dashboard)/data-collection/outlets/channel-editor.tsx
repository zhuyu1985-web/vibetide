"use client";

import { useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CHANNEL_TYPE_LABELS,
  type Channel,
  type ChannelType,
  type WebsiteChannel,
  type WechatOaChannel,
  type DouyinChannel,
  type WeiboChannel,
  type KuaishouChannel,
} from "@/lib/media-outlet/channels";
import {
  parseDouyinProfileUrl,
  parseWeiboProfileUrl,
  parseKuaishouProfileUrl,
  parseWebsiteUrl,
} from "@/lib/media-outlet/url-parsers";

const PLATFORM_ORDER: ChannelType[] = [
  "website",
  "wechat_oa",
  "douyin",
  "weibo",
  "kuaishou",
];

interface Props {
  value: Channel[];
  onChange: (next: Channel[]) => void;
}

/**
 * 分平台 Tab 编辑账号矩阵。每个平台的 Tab 显示该 outlet 在此平台的所有账号(可多个),
 * 提供"添加账号"+"删除"+"粘贴主页 URL 自动解析"。
 */
export function ChannelEditor({ value, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<ChannelType>("website");

  const grouped = groupByPlatform(value);

  function setChannelsOfType(type: ChannelType, next: Channel[]) {
    const others = value.filter((c) => c.type !== type);
    onChange([...others, ...next]);
  }

  return (
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChannelType)}>
        <TabsList variant="line">
          {PLATFORM_ORDER.map((p) => (
            <TabsTrigger key={p} value={p}>
              {CHANNEL_TYPE_LABELS[p]}
              {grouped[p].length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {grouped[p].length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="website" className="mt-3">
          <WebsiteListEditor
            list={grouped.website as WebsiteChannel[]}
            onChange={(next) => setChannelsOfType("website", next)}
          />
        </TabsContent>
        <TabsContent value="wechat_oa" className="mt-3">
          <WechatOaListEditor
            list={grouped.wechat_oa as WechatOaChannel[]}
            onChange={(next) => setChannelsOfType("wechat_oa", next)}
          />
        </TabsContent>
        <TabsContent value="douyin" className="mt-3">
          <DouyinListEditor
            list={grouped.douyin as DouyinChannel[]}
            onChange={(next) => setChannelsOfType("douyin", next)}
          />
        </TabsContent>
        <TabsContent value="weibo" className="mt-3">
          <WeiboListEditor
            list={grouped.weibo as WeiboChannel[]}
            onChange={(next) => setChannelsOfType("weibo", next)}
          />
        </TabsContent>
        <TabsContent value="kuaishou" className="mt-3">
          <KuaishouListEditor
            list={grouped.kuaishou as KuaishouChannel[]}
            onChange={(next) => setChannelsOfType("kuaishou", next)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function groupByPlatform(channels: Channel[]): Record<ChannelType, Channel[]> {
  const out: Record<ChannelType, Channel[]> = {
    website: [],
    wechat_oa: [],
    douyin: [],
    weibo: [],
    kuaishou: [],
  };
  for (const ch of channels) out[ch.type].push(ch);
  return out;
}

// ─── 子编辑器: 每个平台一个 ────────────────────────────────────────────

function ListRow({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-card/40 p-3">
      <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label="删除"
        className="text-destructive shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function EmptyHint({ msg }: { msg: string }) {
  return <p className="text-xs text-muted-foreground py-4 text-center">{msg}</p>;
}

function WebsiteListEditor({
  list,
  onChange,
}: {
  list: WebsiteChannel[];
  onChange: (next: WebsiteChannel[]) => void;
}) {
  function update(i: number, patch: Partial<WebsiteChannel>) {
    onChange(list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add() {
    onChange([...list, { type: "website", url: "", domain: "" }]);
  }
  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {list.length === 0 && <EmptyHint msg={`还没有网站账号,点下面"添加"开始`} />}
      {list.map((c, i) => (
        <ListRow key={i} onRemove={() => remove(i)}>
          <div>
            <Label className="text-[11px] text-muted-foreground">URL</Label>
            <Input
              value={c.url}
              onChange={(e) => {
                const url = e.target.value;
                const parsed = parseWebsiteUrl(url);
                update(i, { url, domain: parsed?.domain ?? c.domain });
              }}
              placeholder="https://www.people.com.cn"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">域名 (自动从 URL 解析)</Label>
            <Input
              value={c.domain}
              onChange={(e) => update(i, { domain: e.target.value })}
              placeholder="people.com.cn"
              className="h-8 text-xs"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground">RSS feed URL (可选)</Label>
            <Input
              value={c.rssUrl ?? ""}
              onChange={(e) => update(i, { rssUrl: e.target.value || undefined })}
              placeholder="https://www.people.com.cn/rss/politics.xml"
              className="h-8 text-xs"
            />
          </div>
        </ListRow>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" />添加网站
      </Button>
    </div>
  );
}

function WechatOaListEditor({
  list,
  onChange,
}: {
  list: WechatOaChannel[];
  onChange: (next: WechatOaChannel[]) => void;
}) {
  function update(i: number, patch: Partial<WechatOaChannel>) {
    onChange(list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add() {
    onChange([...list, { type: "wechat_oa", name: "" }]);
  }
  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {list.length === 0 && <EmptyHint msg={`还没有公众号,点下面"添加"开始`} />}
      {list.map((c, i) => (
        <ListRow key={i} onRemove={() => remove(i)}>
          <div>
            <Label className="text-[11px] text-muted-foreground">公众号名 *</Label>
            <Input
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="人民日报"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">
              ghid (tikhub 必填)
            </Label>
            <Input
              value={c.ghid ?? ""}
              onChange={(e) => update(i, { ghid: e.target.value || undefined })}
              placeholder="gh_a3d35d4c9d3f"
              className={cn(
                "h-8 text-xs font-mono",
                c.ghid && !/^gh_[a-zA-Z0-9]+$/.test(c.ghid) && "border-destructive",
              )}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">微信号 (可选)</Label>
            <Input
              value={c.wechatId ?? ""}
              onChange={(e) => update(i, { wechatId: e.target.value || undefined })}
              placeholder="rmrbwx"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">二维码 URL (可选)</Label>
            <Input
              value={c.qrcodeUrl ?? ""}
              onChange={(e) => update(i, { qrcodeUrl: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </div>
        </ListRow>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" />添加公众号
      </Button>
      <p className="text-[11px] text-muted-foreground">
        tikhub 用 ghid (<code>gh_xxxxx</code>) 拉公众号文章列表。从公众号后台 / 第三方工具获取。
      </p>
    </div>
  );
}

function PasteUrlButton<C extends Channel>({
  parser,
  onParsed,
  placeholder,
}: {
  parser: (url: string) => C | null;
  onParsed: (c: C) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Wand2 className="h-3.5 w-3.5 mr-1" />粘贴主页 URL 解析
      </Button>
    );
  }
  return (
    <div className="flex gap-2 items-center">
      <Input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs flex-1"
      />
      <Button
        type="button"
        size="sm"
        onClick={() => {
          const parsed = parser(url);
          if (!parsed) {
            toast.error("无法识别这个 URL,请手动填字段");
            return;
          }
          onParsed(parsed);
          setUrl("");
          setOpen(false);
          toast.success("已解析,记得补全昵称");
        }}
      >
        解析
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        取消
      </Button>
    </div>
  );
}

function DouyinListEditor({
  list,
  onChange,
}: {
  list: DouyinChannel[];
  onChange: (next: DouyinChannel[]) => void;
}) {
  function update(i: number, patch: Partial<DouyinChannel>) {
    onChange(list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add(initial?: DouyinChannel) {
    onChange([...list, initial ?? { type: "douyin", nickname: "", secUid: "" }]);
  }
  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {list.length === 0 && <EmptyHint msg={`还没有抖音号,点下面"添加"或粘贴主页 URL 开始`} />}
      {list.map((c, i) => (
        <ListRow key={i} onRemove={() => remove(i)}>
          <div>
            <Label className="text-[11px] text-muted-foreground">昵称 *</Label>
            <Input
              value={c.nickname}
              onChange={(e) => update(i, { nickname: e.target.value })}
              placeholder="人民日报"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">sec_user_id * (tikhub 必填)</Label>
            <Input
              value={c.secUid}
              onChange={(e) => update(i, { secUid: e.target.value })}
              placeholder="MS4wLjABAAAA..."
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground">主页 URL (可选)</Label>
            <Input
              value={c.profileUrl ?? ""}
              onChange={(e) => update(i, { profileUrl: e.target.value || undefined })}
              placeholder="https://www.douyin.com/user/MS4wLjABxxx"
              className="h-8 text-xs"
            />
          </div>
        </ListRow>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => add()}>
          <Plus className="h-3.5 w-3.5 mr-1" />添加抖音号
        </Button>
        <PasteUrlButton
          parser={parseDouyinProfileUrl}
          onParsed={add}
          placeholder="粘贴 https://www.douyin.com/user/MS4wxxx"
        />
      </div>
    </div>
  );
}

function WeiboListEditor({
  list,
  onChange,
}: {
  list: WeiboChannel[];
  onChange: (next: WeiboChannel[]) => void;
}) {
  function update(i: number, patch: Partial<WeiboChannel>) {
    onChange(list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add(initial?: WeiboChannel) {
    onChange([...list, initial ?? { type: "weibo", nickname: "", uid: "" }]);
  }
  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {list.length === 0 && <EmptyHint msg={`还没有微博账号,点下面"添加"或粘贴主页 URL 开始`} />}
      {list.map((c, i) => (
        <ListRow key={i} onRemove={() => remove(i)}>
          <div>
            <Label className="text-[11px] text-muted-foreground">昵称 *</Label>
            <Input
              value={c.nickname}
              onChange={(e) => update(i, { nickname: e.target.value })}
              placeholder="人民日报"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">uid * (数字,tikhub 必填)</Label>
            <Input
              value={c.uid}
              onChange={(e) => update(i, { uid: e.target.value })}
              placeholder="2803301701"
              className={cn(
                "h-8 text-xs font-mono",
                c.uid && !/^\d+$/.test(c.uid) && "border-destructive",
              )}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground">主页 URL (可选)</Label>
            <Input
              value={c.profileUrl ?? ""}
              onChange={(e) => update(i, { profileUrl: e.target.value || undefined })}
              placeholder="https://weibo.com/u/2803301701"
              className="h-8 text-xs"
            />
          </div>
        </ListRow>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => add()}>
          <Plus className="h-3.5 w-3.5 mr-1" />添加微博账号
        </Button>
        <PasteUrlButton
          parser={parseWeiboProfileUrl}
          onParsed={add}
          placeholder="粘贴 https://weibo.com/u/2803301701"
        />
      </div>
    </div>
  );
}

function KuaishouListEditor({
  list,
  onChange,
}: {
  list: KuaishouChannel[];
  onChange: (next: KuaishouChannel[]) => void;
}) {
  function update(i: number, patch: Partial<KuaishouChannel>) {
    onChange(list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add(initial?: KuaishouChannel) {
    onChange([...list, initial ?? { type: "kuaishou", nickname: "", userId: "" }]);
  }
  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {list.length === 0 && <EmptyHint msg={`还没有快手号,点下面"添加"或粘贴主页 URL 开始`} />}
      {list.map((c, i) => (
        <ListRow key={i} onRemove={() => remove(i)}>
          <div>
            <Label className="text-[11px] text-muted-foreground">昵称 *</Label>
            <Input
              value={c.nickname}
              onChange={(e) => update(i, { nickname: e.target.value })}
              placeholder="人民日报"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">userId * (主页 URL 末段)</Label>
            <Input
              value={c.userId}
              onChange={(e) => update(i, { userId: e.target.value })}
              placeholder="3xy4nh4nzqzkfxg"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground">主页 URL (可选)</Label>
            <Input
              value={c.profileUrl ?? ""}
              onChange={(e) => update(i, { profileUrl: e.target.value || undefined })}
              placeholder="https://www.kuaishou.com/profile/3xy4nh4nzqzkfxg"
              className="h-8 text-xs"
            />
          </div>
        </ListRow>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => add()}>
          <Plus className="h-3.5 w-3.5 mr-1" />添加快手号
        </Button>
        <PasteUrlButton
          parser={parseKuaishouProfileUrl}
          onParsed={add}
          placeholder="粘贴 https://www.kuaishou.com/profile/xxx"
        />
      </div>
    </div>
  );
}

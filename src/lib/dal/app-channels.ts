import { db } from "@/db";
import { appChannels } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export type AppChannelSlug =
  | "app_home"
  | "app_news"
  | "app_politics"
  | "app_sports"
  | "app_variety"
  | "app_livelihood_zhongcao"
  | "app_livelihood_tandian"
  | "app_livelihood_podcast"
  | "app_drama";

export const ALL_APP_CHANNEL_SLUGS: readonly AppChannelSlug[] = [
  "app_home",
  "app_news",
  "app_politics",
  "app_sports",
  "app_variety",
  "app_livelihood_zhongcao",
  "app_livelihood_tandian",
  "app_livelihood_podcast",
  "app_drama",
] as const;

export interface UpsertAppChannelInput {
  slug: AppChannelSlug;
  displayName: string;
  reviewTier: "strict" | "relaxed";
  sortOrder?: number;
  icon?: string;
  defaultCoverUrl?: string;
}

export async function upsertAppChannel(
  organizationId: string,
  input: UpsertAppChannelInput,
): Promise<void> {
  await db
    .insert(appChannels)
    .values({
      organizationId,
      slug: input.slug,
      displayName: input.displayName,
      reviewTier: input.reviewTier,
      sortOrder: input.sortOrder ?? 0,
      icon: input.icon ?? null,
      defaultCoverUrl: input.defaultCoverUrl ?? null,
    })
    .onConflictDoUpdate({
      target: [appChannels.organizationId, appChannels.slug],
      set: {
        displayName: input.displayName,
        reviewTier: input.reviewTier,
        sortOrder: input.sortOrder ?? 0,
        icon: input.icon ?? null,
        defaultCoverUrl: input.defaultCoverUrl ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function getAppChannelBySlug(
  organizationId: string,
  slug: string,
) {
  const row = await db.query.appChannels.findFirst({
    where: and(
      eq(appChannels.organizationId, organizationId),
      eq(appChannels.slug, slug),
    ),
    with: { defaultCatalog: true },
  });
  return row ?? null;
}

export async function listAppChannels(organizationId: string) {
  return await db.query.appChannels.findMany({
    where: eq(appChannels.organizationId, organizationId),
    orderBy: [asc(appChannels.sortOrder)],
    with: { defaultCatalog: true },
  });
}

export interface UpdateBindingInput {
  defaultCatalogId: string;
  defaultListStyle?: {
    listStyleType?: string;
    listStyleName?: string;
    imageUrlList?: string[];
  };
  defaultCoverUrl?: string;
}

export async function updateAppChannelBinding(
  organizationId: string,
  slug: string,
  input: UpdateBindingInput,
): Promise<void> {
  await db
    .update(appChannels)
    .set({
      defaultCatalogId: input.defaultCatalogId,
      defaultListStyle: input.defaultListStyle ?? null,
      defaultCoverUrl: input.defaultCoverUrl ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(appChannels.organizationId, organizationId), eq(appChannels.slug, slug)),
    );
}

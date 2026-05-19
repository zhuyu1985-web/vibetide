export const JSON_IMPORT_PLATFORM = "网站";
export const PEOPLE_JSON_IMPORT_ACCOUNT = "人民网";
export const CQNEWS_JSON_IMPORT_ACCOUNT = "华龙网";

const JSON_IMPORT_CHANNEL_ACCOUNT_MAP: Record<string, string> = {
  people: PEOPLE_JSON_IMPORT_ACCOUNT,
  cqnews: CQNEWS_JSON_IMPORT_ACCOUNT,
};

export function getJsonImportAccountName(
  channel: string,
  sourceName?: string,
  author?: string,
): string | null {
  const normalizedChannel = channel.toLowerCase();
  if (normalizedChannel.startsWith("json_import/")) {
    const importName = normalizedChannel.slice("json_import/".length).split("/", 1)[0];
    const mapped = JSON_IMPORT_CHANNEL_ACCOUNT_MAP[importName];
    if (mapped) return mapped;
  }
  return sourceName ?? author ?? null;
}

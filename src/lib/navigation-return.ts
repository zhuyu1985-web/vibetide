export const RETURN_TO_PARAM = "returnTo";
const CUSTOMIZE_RETURN_STORAGE_KEY = "vibetide:cowork-customize-return";

type SearchParamReader = {
  get(name: string): string | null;
};

type ReturnStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function appendReturnTo(href: string, currentPath: string): string {
  const url = new URL(href, "https://vibetide.local");
  url.searchParams.set(RETURN_TO_PARAM, currentPath);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getSafeReturnTo(
  searchParams: SearchParamReader,
  fallbackHref: string,
): string {
  const value = searchParams.get(RETURN_TO_PARAM);
  return isSafeReturnTarget(value) ? value : fallbackHref;
}

function isSafeReturnTarget(value: string | null): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export function markCustomizeReturn(storage: ReturnStorage): void {
  storage.setItem(CUSTOMIZE_RETURN_STORAGE_KEY, "1");
}

export function consumeCustomizeReturn(storage: ReturnStorage): boolean {
  const shouldOpen = storage.getItem(CUSTOMIZE_RETURN_STORAGE_KEY) === "1";
  storage.removeItem(CUSTOMIZE_RETURN_STORAGE_KEY);
  return shouldOpen;
}

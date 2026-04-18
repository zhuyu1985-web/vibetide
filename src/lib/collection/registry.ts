import type { SourceAdapter } from "./types";

const ADAPTER_REGISTRY = new Map<string, SourceAdapter<any>>();

export function registerAdapter(adapter: SourceAdapter<any>): void {
  if (ADAPTER_REGISTRY.has(adapter.type)) {
    throw new Error(`Adapter type "${adapter.type}" already registered`);
  }
  ADAPTER_REGISTRY.set(adapter.type, adapter);
}

export function getAdapter(type: string): SourceAdapter<any> {
  const adapter = ADAPTER_REGISTRY.get(type);
  if (!adapter) throw new Error(`Unknown source adapter type: "${type}"`);
  return adapter;
}

export function listAdapters(): SourceAdapter<any>[] {
  return Array.from(ADAPTER_REGISTRY.values());
}

/** Test helper — clears registry. DO NOT use in prod code paths. */
export function __resetAdapterRegistry(): void {
  ADAPTER_REGISTRY.clear();
}

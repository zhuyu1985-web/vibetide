import "@/lib/collection/adapters"; // ensure registered
import { listAdapters } from "./registry";
import type { AdapterCategory, ConfigField } from "./types";

export interface AdapterMeta {
  type: string;
  displayName: string;
  description: string;
  category: AdapterCategory;
  configFields: ConfigField[];
}

export function listAdapterMetas(): AdapterMeta[] {
  return listAdapters().map((a) => ({
    type: a.type,
    displayName: a.displayName,
    description: a.description,
    category: a.category,
    configFields: a.configFields,
  }));
}

export function getAdapterMeta(type: string): AdapterMeta | null {
  return listAdapterMetas().find((m) => m.type === type) ?? null;
}

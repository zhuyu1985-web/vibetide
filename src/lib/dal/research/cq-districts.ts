// src/lib/dal/research/cq-districts.ts
import { db } from "@/db";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { asc } from "drizzle-orm";

export type CqDistrict = {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
};

export async function listCqDistricts(): Promise<CqDistrict[]> {
  const rows = await db
    .select()
    .from(cqDistricts)
    .orderBy(asc(cqDistricts.sortOrder), asc(cqDistricts.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    sortOrder: r.sortOrder,
  }));
}

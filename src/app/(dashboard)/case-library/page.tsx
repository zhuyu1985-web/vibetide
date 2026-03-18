import { getCaseLibraryItems } from "@/lib/dal/content-excellence";
import CaseLibraryClient from "./case-library-client";

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function CaseLibraryPage() {
  const cases = await withTimeout(getCaseLibraryItems(), []);

  return <CaseLibraryClient cases={cases} />;
}

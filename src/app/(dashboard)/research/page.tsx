import { redirect } from "next/navigation";

interface ResearchPageProps {
  searchParams: Promise<{ mode?: string; tab?: string }>;
}

export default async function ResearchRedirect({ searchParams }: ResearchPageProps) {
  const { mode, tab } = await searchParams;
  if (mode === "topics" || tab === "topics") {
    redirect("/data-collection/topics");
  }
  redirect("/data-collection/content");
}

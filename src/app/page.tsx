import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "./landing/landing-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/team-hub");
    }
  } catch {
    // Supabase unavailable — show landing page
  }

  return <LandingPage />;
}

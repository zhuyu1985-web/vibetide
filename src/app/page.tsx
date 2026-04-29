import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LandingPage } from "./landing/landing-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/home");
  }
  return <LandingPage />;
}

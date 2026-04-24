"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/home");
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

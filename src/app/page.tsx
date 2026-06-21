import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Dear My Routines</h1>
      <p className="max-w-md text-sm text-neutral-500">
        A personal time-management app — measure estimate vs. actual each day to
        sharpen your sense of time. Coming soon.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

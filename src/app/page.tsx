import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { PlanPanel } from "@/components/panels/PlanPanel";
import { ActPanel } from "@/components/panels/ActPanel";
import { ReviewPanel } from "@/components/panels/ReviewPanel";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <h1 className="text-base font-semibold tracking-tight">Dear My Routines</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3">
        <PlanPanel />
        <ActPanel />
        <ReviewPanel />
      </main>
    </div>
  );
}

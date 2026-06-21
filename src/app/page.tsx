import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { PlanPanel } from "@/components/panels/PlanPanel";
import { ActPanel } from "@/components/panels/ActPanel";
import { ReviewPanel } from "@/components/panels/ReviewPanel";
import { ThemeMenu } from "@/components/ThemeMenu";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-panel px-6 py-3">
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Dear My Routines
        </h1>
        <div className="flex items-center gap-2">
          <ThemeMenu />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3">
        <PlanPanel />
        <ActPanel />
        <ReviewPanel />
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { ProjectLegend } from "@/components/calendar/ProjectLegend";
import { DateBar } from "@/components/DateBar";
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
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <DateBar />
        <div className="mt-3">
          <ProjectLegend />
        </div>
        <div className="mt-3">
          <CalendarGrid />
        </div>
      </main>
    </div>
  );
}

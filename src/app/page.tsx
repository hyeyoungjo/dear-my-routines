import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { ProjectLegend } from "@/components/calendar/ProjectLegend";
import { DateBar } from "@/components/DateBar";
import { ThemeMenu } from "@/components/ThemeMenu";
import { SignOutButton } from "@/components/SignOutButton";
import { KofiButton } from "@/components/KofiButton";
import { FeedbackButton } from "@/components/FeedbackButton";
import { getUserRole } from "@/lib/userRole";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.email ? await getUserRole(user.email) : "user";
  const isAdmin = role === "admin";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 sm:px-6">
        <h1 className="shrink-0 whitespace-nowrap text-base font-semibold tracking-tight text-foreground">
          Dear My Routines
        </h1>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <FeedbackButton userEmail={user?.email ?? ""} />
          <KofiButton />
          <ThemeMenu isAdmin={isAdmin} />
          <SignOutButton
            action={signOut}
            className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <div id="snapshot-area" className="overflow-hidden rounded-xl p-4">
          <DateBar />
          <div className="no-scrollbar mt-3 overflow-x-auto">
            <ProjectLegend />
          </div>
          <div className="mt-3">
            <CalendarGrid />
          </div>
        </div>
      </main>
    </div>
  );
}

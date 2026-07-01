import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { ProjectLegend } from "@/components/calendar/ProjectLegend";
import {
  SidebarProvider,
  LeftPanelToggle,
  RightPanelToggle,
  LeftRail,
  RightRail,
} from "@/components/AppSidebar";
import { DateBar } from "@/components/DateBar";
import { ThemeMenu } from "@/components/ThemeMenu";
import { SignOutButton } from "@/components/SignOutButton";
import { KofiButton } from "@/components/KofiButton";
import { FeedbackButton } from "@/components/FeedbackButton";
import { GuideButton } from "@/components/GuideButton";
import { HeaderMenu } from "@/components/HeaderMenu";
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
    <SidebarProvider>
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 sm:px-6">
        <a
          href="https://dearmyroutines.hyeyoungjo.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap text-base font-semibold tracking-tight text-foreground hover:opacity-70 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.png" alt="" className="size-6 rounded-md" />
          Dear My Routines
        </a>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Desktop: inline icon row. */}
          <div className="hidden items-center gap-1 sm:flex sm:gap-2">
            <GuideButton />
            <FeedbackButton userEmail={user?.email ?? ""} />
            <KofiButton />
            <LeftPanelToggle />
            <RightPanelToggle />
            <ThemeMenu isAdmin={isAdmin} />
            <SignOutButton
              action={signOut}
              className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
            />
          </div>
          {/* Mobile: everything collapses into a hamburger menu. */}
          <HeaderMenu
            userEmail={user?.email ?? ""}
            isAdmin={isAdmin}
            signOut={signOut}
          />
        </div>
      </header>
      {/* App shell body: left (Shelf) · middle (calendar) · right (reserved).
          Rails are desktop-only; on mobile the Shelf is the 4th tab in the
          calendar and the body is a single column. */}
      <div className="flex flex-1 gap-4 p-4">
        {/* Left rail — Shelf (ADR-026): inline on desktop, drawer on mobile,
            toggled by the header button. */}
        <LeftRail />

        {/* Middle — the calendar (Plan / Act / Reflect). */}
        <main className="min-w-0 flex-1">
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

        {/* Right rail — AI panel (ADR-020), inline on desktop / drawer on mobile. */}
        <RightRail />
      </div>
    </div>
    </SidebarProvider>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Private Beta
        </h1>
        <p className="mt-4 text-sm text-neutral-500">
          This app is currently private. Your account is not on the access list.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <SignOutButton
            action={signOut}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          />
          <Link
            href="/login"
            className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}

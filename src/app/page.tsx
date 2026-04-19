import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { signOutAction } from "@/server/actions/auth"
import { Button } from "@/components/ui/button"

export default async function LandingPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defense in depth: middleware should have redirected already, but if
  // somehow an unauthenticated request lands here, redirect to login.
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Commitment Tracker</p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Welcome, {user.email}</h1>
          <p className="text-base text-muted-foreground">
            Your goals are coming in Phase 2.
          </p>
        </div>
      </main>
    </div>
  )
}

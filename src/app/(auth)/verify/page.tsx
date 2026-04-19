import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function VerifyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Email verified</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your account is confirmed. You can now sign in.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

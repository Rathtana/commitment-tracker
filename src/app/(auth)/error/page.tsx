import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Verification failed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This link may have expired or already been used. Request a new
          verification email by signing up again.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/signup">Back to sign up</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

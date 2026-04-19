import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoginForm } from "@/components/auth/login-form"

type SearchParams = Promise<{ reset?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { reset } = await searchParams
  const resetSuccess = reset === "success"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Sign in to your account</CardTitle>
      </CardHeader>
      <CardContent>
        {resetSuccess && (
          <div aria-live="polite" className="mb-4">
            <Alert>
              <AlertDescription>
                Your password has been updated. Sign in with your new password.
              </AlertDescription>
            </Alert>
          </div>
        )}
        <LoginForm />
      </CardContent>
    </Card>
  )
}

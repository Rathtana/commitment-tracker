import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UpdatePasswordForm } from "@/components/auth/update-password-form"

export default function ResetCompletePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Set a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  )
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SignUpForm } from "@/components/auth/signup-form"

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  )
}

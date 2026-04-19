"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { requestPasswordResetAction } from "@/server/actions/auth"
import { resetRequestSchema, type ResetRequestInput } from "@/lib/schemas/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"

export function ResetPasswordForm() {
  const [sent, setSent] = React.useState(false)

  const form = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form

  async function onSubmit(data: ResetRequestInput) {
    const result = await requestPasswordResetAction(data)
    if (result?.error) {
      setError("root", { message: result.error })
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <Alert>
        <AlertDescription>
          If that email is registered, you&apos;ll receive a reset link shortly.
          Check your inbox.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        aria-busy={isSubmitting}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {errors.root?.message && (
          <div aria-live="polite">
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </Form>
  )
}

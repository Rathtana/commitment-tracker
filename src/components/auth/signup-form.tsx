"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import type { z } from "zod"
import { signUpAction } from "@/server/actions/auth"
import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth"
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
import { PasswordInput } from "./password-input"

/**
 * signUpSchema uses `z.string().default("UTC")` for timezone, which makes the
 * Zod INPUT type differ from the OUTPUT type (input: optional string; output:
 * string). @hookform/resolvers types the Resolver using the INPUT shape, so
 * RHF's form values must mirror that shape. We use z.input here and pass the
 * parsed SignUpInput (output) to the server action in onSubmit.
 */
type SignUpFormValues = z.input<typeof signUpSchema>

export function SignUpForm() {
  const [success, setSuccess] = React.useState(false)

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      timezone: "UTC",
    },
  })

  const {
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = form

  async function onSubmit(data: SignUpFormValues) {
    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    const payload: SignUpInput = {
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
      timezone: tz,
    }
    const result = await signUpAction(payload)
    if (result?.error) {
      setError("root", { message: result.error })
      return
    }
    reset()
    setSuccess(true)
  }

  if (success) {
    return (
      <Alert>
        <AlertDescription>
          Check your email to verify your account. You can close this tab.
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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="8+ characters"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="Repeat your password"
                  autoComplete="new-password"
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
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  )
}

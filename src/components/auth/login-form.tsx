"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { signInAction } from "@/server/actions/auth"
import { signInSchema, type SignInInput } from "@/lib/schemas/auth"
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

export function LoginForm() {
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form

  async function onSubmit(data: SignInInput) {
    const result = await signInAction(data)
    if (result?.error) {
      setError("root", { message: result.error })
    }
    // On success, signInAction calls redirect("/") — control does not return here.
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
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/auth/reset"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot your password?
                </Link>
              </div>
              <FormControl>
                <PasswordInput
                  placeholder="Your password"
                  autoComplete="current-password"
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
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </p>
      </form>
    </Form>
  )
}

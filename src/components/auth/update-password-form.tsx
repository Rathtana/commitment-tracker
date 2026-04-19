"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { updatePasswordAction } from "@/server/actions/auth"
import {
  updatePasswordSchema,
  type UpdatePasswordInput,
} from "@/lib/schemas/auth"
import { Button } from "@/components/ui/button"
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

export function UpdatePasswordForm() {
  const form = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form

  async function onSubmit(data: UpdatePasswordInput) {
    const result = await updatePasswordAction(data)
    if (result?.error) {
      setError("root", { message: result.error })
    }
    // Server action redirects to /login?reset=success on success.
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
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
                  placeholder="Repeat your new password"
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
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
        </Button>
      </form>
    </Form>
  )
}

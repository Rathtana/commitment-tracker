'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { deleteGoalAction } from '@/server/actions/goals'

interface DeleteGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId: string
  goalTitle: string
  onDeleted?: () => void
}

export function DeleteGoalDialog({
  open,
  onOpenChange,
  goalId,
  goalTitle,
  onDeleted,
}: DeleteGoalDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const r = await deleteGoalAction({ goalId })
    setSubmitting(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    onOpenChange(false)
    onDeleted?.()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {goalTitle}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the goal and all its progress. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Deleting…' : 'Delete goal'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

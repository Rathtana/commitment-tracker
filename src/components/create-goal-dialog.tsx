'use client'

import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GoalTypePicker } from '@/components/goal-type-picker'
import {
  createGoalSchema,
  updateGoalSchema,
  type CreateGoalInput,
  type UpdateGoalInput,
} from '@/lib/schemas/goals'
import { createGoalAction, updateGoalAction } from '@/server/actions/goals'

type GoalType = 'count' | 'checklist' | 'habit'

type EditingGoal =
  | { goalId: string; type: 'count'; title: string; notes?: string; targetCount: number }
  | {
      goalId: string
      type: 'checklist'
      title: string
      notes?: string
      tasks: { label: string; position: number }[]
    }
  | { goalId: string; type: 'habit'; title: string; notes?: string; targetDays: number }

interface CreateGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: EditingGoal | null
  /** Days in the current month — used as the default targetDays value for new habit goals */
  daysInMonthDefault: number
}

type FormValues = CreateGoalInput | UpdateGoalInput

export function CreateGoalDialog({
  open,
  onOpenChange,
  editing,
  daysInMonthDefault,
}: CreateGoalDialogProps) {
  const isEdit = Boolean(editing)
  const [step, setStep] = React.useState<'picker' | 'fields'>(isEdit ? 'fields' : 'picker')
  const [chosenType, setChosenType] = React.useState<GoalType | null>(editing?.type ?? null)
  const [rootError, setRootError] = React.useState<string | null>(null)

  // Reset state when dialog opens/closes or editing target changes
  React.useEffect(() => {
    if (!open) return
    if (editing) {
      setStep('fields')
      setChosenType(editing.type)
    } else {
      setStep('picker')
      setChosenType(null)
    }
    setRootError(null)
  }, [open, editing])

  const form = useForm<FormValues>({
    resolver: zodResolver(isEdit ? updateGoalSchema : createGoalSchema) as any,
    defaultValues: editing
      ? (editing as any)
      : ({ type: (chosenType ?? 'count') as any, title: '' } as any),
  })

  // When chosenType changes (Step 1 → Step 2 on create), reset form with the right shape
  React.useEffect(() => {
    if (!chosenType || isEdit) return
    const base: any = { type: chosenType, title: '', notes: '' }
    if (chosenType === 'count') base.targetCount = 5
    if (chosenType === 'habit') base.targetDays = daysInMonthDefault
    if (chosenType === 'checklist') base.tasks = [{ label: '', position: 0 }]
    form.reset(base)
  }, [chosenType, isEdit, daysInMonthDefault, form])

  const { fields, append, remove } = useFieldArray({
    control: form.control as any,
    name: 'tasks' as any,
  })

  async function onSubmit(data: FormValues) {
    setRootError(null)
    const result = isEdit
      ? await updateGoalAction(data as UpdateGoalInput)
      : await createGoalAction(data as CreateGoalInput)
    if (!result.ok) {
      setRootError(result.error)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {step === 'picker' && !isEdit && (
          <>
            <DialogHeader>
              <DialogTitle>Create a goal</DialogTitle>
              <DialogDescription>
                Choose what kind of goal you want to track this month.
              </DialogDescription>
            </DialogHeader>
            <GoalTypePicker
              onSelect={(t) => {
                setChosenType(t)
                setStep('fields')
              }}
            />
            <DialogFooter className="sm:justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'fields' && chosenType && (
          <>
            <DialogHeader>
              <DialogTitle>
                {isEdit
                  ? `Edit ${(editing as EditingGoal).title}`
                  : `Create a ${chosenType} goal`}
              </DialogTitle>
              {isEdit ? (
                <DialogDescription>
                  Type: {chosenType} · Cannot be changed after creation
                </DialogDescription>
              ) : (
                <button
                  type="button"
                  className="text-left text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setStep('picker')}
                >
                  ← Back
                </button>
              )}
            </DialogHeader>

            <Form {...(form as any)}>
              <form
                onSubmit={form.handleSubmit(onSubmit as any)}
                className="space-y-4"
                aria-busy={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control as any}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What are you committing to?</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Read 5 books" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {chosenType === 'count' && (
                  <FormField
                    control={form.control as any}
                    name="targetCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            placeholder="5"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <span className="text-xs text-muted-foreground">times</span>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {chosenType === 'habit' && (
                  <FormField
                    control={form.control as any}
                    name="targetDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goal</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          How many days this month do you want to show up?
                        </p>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <span className="text-xs text-muted-foreground">
                          of {daysInMonthDefault} days
                        </span>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {chosenType === 'checklist' && (
                  <div className="flex flex-col gap-2">
                    <Label>Tasks</Label>
                    <p className="text-sm text-muted-foreground">
                      Add at least one task. You can add, rename, or remove tasks later.
                    </p>
                    {fields.map((f, idx) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <Input
                          placeholder="e.g. Paint the living room"
                          {...form.register(`tasks.${idx}.label` as any)}
                        />
                        <input
                          type="hidden"
                          {...form.register(`tasks.${idx}.position` as any, {
                            valueAsNumber: true,
                          })}
                          value={idx}
                        />
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ label: '', position: fields.length } as any)}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add task
                    </Button>
                  </div>
                )}

                <FormField
                  control={form.control as any}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Why this matters, or how you'll approach it."
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {rootError && (
                  <div aria-live="polite">
                    <Alert variant="destructive">
                      <AlertDescription>{rootError}</AlertDescription>
                    </Alert>
                  </div>
                )}

                <DialogFooter className="sm:justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isEdit ? (
                      'Save changes'
                    ) : (
                      'Create goal'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

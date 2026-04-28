'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  reflectionFormSchema,
  type ReflectionFormInput,
} from '@/lib/schemas/reflections'
import { upsertReflectionAction } from '@/server/actions/reflections'

const DEBOUNCE_MS = 800

interface Props {
  monthIsoDate: string      // "YYYY-MM-DD" first-of-month
  monthYearLabel: string    // "April 2026"
  initial: { whatWorked: string | null; whatDidnt: string | null } | null
}

function counterClass(n: number): string {
  if (n >= 280) return 'text-destructive'
  if (n >= 250) return 'text-warning-foreground bg-warning-muted inline-block rounded px-1'
  return 'text-muted-foreground'
}

export function ReflectionCard({ monthIsoDate, monthYearLabel, initial }: Props) {
  const form = useForm<ReflectionFormInput>({
    resolver: zodResolver(reflectionFormSchema),
    defaultValues: {
      whatWorked: initial?.whatWorked ?? '',
      whatDidnt: initial?.whatDidnt ?? '',
    },
  })
  const { register, watch } = form
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track the values as loaded from the server so we only autosave on actual user edits.
  // This also prevents React Strict Mode's double-invocation from triggering a spurious save.
  const serverValuesRef = useRef({
    ww: initial?.whatWorked ?? '',
    wd: initial?.whatDidnt ?? '',
  })

  const ww = watch('whatWorked')
  const wd = watch('whatDidnt')

  function save() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    startTransition(async () => {
      const result = await upsertReflectionAction({
        month: monthIsoDate,
        whatWorked: ww,
        whatDidnt: wd,
      })
      if (result.ok) {
        const stamp = Date.now()
        setSavedAt(stamp)
        setTimeout(() => {
          setSavedAt((current) => (current === stamp ? null : current))
        }, 3000)
      } else {
        toast.error('Reflection not saved — check your connection')
      }
    })
  }

  // Debounced autosave — only fires when values differ from what was loaded from the server.
  useEffect(() => {
    const unchanged =
      ww === serverValuesRef.current.ww && wd === serverValuesRef.current.wd
    if (unchanged) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => save(), DEBOUNCE_MS)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ww, wd])

  const onBlur = () => save()

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center gap-2">
          <PenLine className="size-4 text-muted-foreground" />
          <CardTitle className="text-2xl font-semibold">Reflection &mdash; {monthYearLabel}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="what-worked">What worked</Label>
          <Textarea
            id="what-worked"
            maxLength={280}
            className="min-h-[88px] max-h-[240px] resize-none"
            placeholder="One thing that went right this month..."
            {...register('whatWorked', { onBlur })}
          />
          <div className="flex items-center justify-end">
            <span
              aria-live="polite"
              aria-atomic="true"
              className={cn('text-xs tabular-nums', counterClass(ww.length))}
            >
              {ww.length}/280
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="what-didnt">What didn&apos;t</Label>
          <Textarea
            id="what-didnt"
            maxLength={280}
            className="min-h-[88px] max-h-[240px] resize-none"
            placeholder="One thing to change next month..."
            {...register('whatDidnt', { onBlur })}
          />
          <div className="flex items-center justify-end">
            <span
              aria-live="polite"
              aria-atomic="true"
              className={cn('text-xs tabular-nums', counterClass(wd.length))}
            >
              {wd.length}/280
            </span>
          </div>
        </div>

        <div className="h-5 flex items-center justify-end">
          <span
            aria-live="polite"
            className={cn(
              'text-sm font-semibold text-success-foreground motion-safe:transition-opacity motion-safe:duration-300',
              savedAt ? 'opacity-100' : 'opacity-0',
            )}
          >
            Saved
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

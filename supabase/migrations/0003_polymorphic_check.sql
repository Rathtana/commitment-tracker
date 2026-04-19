-- Polymorphic-validity CHECK + non-negativity CHECKs on public.goals
-- source: 02-CONTEXT.md D-04 + D-03
-- Cannot be expressed in Drizzle pgTable; added manually per 02-RESEARCH.md Pattern 1 + Pitfall 3.

ALTER TABLE public.goals
  ADD CONSTRAINT goals_polymorphic_validity
  CHECK (
    (type = 'count'     AND target_count IS NOT NULL AND current_count IS NOT NULL AND target_days IS NULL)
    OR (type = 'checklist' AND target_count IS NULL     AND current_count IS NULL     AND target_days IS NULL)
    OR (type = 'habit'     AND target_count IS NULL     AND current_count IS NULL     AND target_days IS NOT NULL)
  );

ALTER TABLE public.goals
  ADD CONSTRAINT goals_current_count_non_negative
  CHECK (current_count IS NULL OR current_count >= 0);

ALTER TABLE public.goals
  ADD CONSTRAINT goals_target_count_positive
  CHECK (target_count IS NULL OR target_count > 0);

ALTER TABLE public.goals
  ADD CONSTRAINT goals_target_days_positive
  CHECK (target_days IS NULL OR target_days > 0);

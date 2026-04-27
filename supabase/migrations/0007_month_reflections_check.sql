-- Phase 3 / D-24: month_reflections.month must be first-of-month.
-- drizzle-kit doesn't emit CHECK constraints from table definitions — Phase 1 D-09 pattern.
ALTER TABLE public.month_reflections
  ADD CONSTRAINT month_reflections_month_is_first_of_month
  CHECK (EXTRACT(DAY FROM month) = 1);

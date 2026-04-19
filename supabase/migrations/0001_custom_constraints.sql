-- CHECK constraint: goals.month must be first-of-month (GOAL-04, CONTEXT.md D-05)
-- Cannot be expressed in Drizzle pgTable; added manually per RESEARCH.md Pitfall 3.
ALTER TABLE public.goals
  ADD CONSTRAINT month_is_first_of_month
  CHECK (EXTRACT(DAY FROM month) = 1);

-- auth.users -> public.users trigger (CONTEXT.md D-08)
-- Supabase auth schema is internal; Drizzle cannot generate this.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, timezone)
  VALUES (NEW.id, 'UTC');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

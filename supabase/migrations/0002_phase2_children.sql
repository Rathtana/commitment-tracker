CREATE TABLE "habit_check_ins" (
	"goal_id" uuid NOT NULL,
	"check_in_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_check_ins_pk" PRIMARY KEY("goal_id","check_in_date")
);
--> statement-breakpoint
ALTER TABLE "habit_check_ins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "progress_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logged_local_date" date NOT NULL,
	"undo_id" uuid
);
--> statement-breakpoint
ALTER TABLE "progress_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "target_count" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "current_count" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "target_days" integer;--> statement-breakpoint
ALTER TABLE "habit_check_ins" ADD CONSTRAINT "habit_check_ins_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "habit-check-ins-select-own" ON "habit_check_ins" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "habit-check-ins-insert-own" ON "habit_check_ins" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "habit-check-ins-update-own" ON "habit_check_ins" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "habit-check-ins-delete-own" ON "habit_check_ins" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "progress-entries-select-own" ON "progress_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "progress-entries-insert-own" ON "progress_entries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "progress-entries-update-own" ON "progress_entries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "progress-entries-delete-own" ON "progress_entries" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "tasks-select-own" ON "tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "tasks-insert-own" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "tasks-update-own" ON "tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "tasks-delete-own" ON "tasks" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
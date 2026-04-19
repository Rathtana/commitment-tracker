CREATE TABLE "habit_check_in_undos" (
	"undo_id" uuid PRIMARY KEY NOT NULL,
	"goal_id" uuid NOT NULL,
	"check_in_date" date NOT NULL,
	"was_checked" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habit_check_in_undos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "habit_check_in_undos" ADD CONSTRAINT "habit_check_in_undos_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "habit-check-in-undos-select-own" ON "habit_check_in_undos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "habit-check-in-undos-insert-own" ON "habit_check_in_undos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "habit-check-in-undos-update-own" ON "habit_check_in_undos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "habit-check-in-undos-delete-own" ON "habit_check_in_undos" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
CREATE TABLE "month_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"what_worked" text,
	"what_didnt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "month_reflections_user_month_key" UNIQUE("user_id","month")
);
--> statement-breakpoint
ALTER TABLE "month_reflections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "month_reflections" ADD CONSTRAINT "month_reflections_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "month-reflections-select-own" ON "month_reflections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "month-reflections-insert-own" ON "month_reflections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "month-reflections-update-own" ON "month_reflections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "month-reflections-delete-own" ON "month_reflections" AS PERMISSIVE FOR DELETE TO "authenticated" USING (user_id = auth.uid());
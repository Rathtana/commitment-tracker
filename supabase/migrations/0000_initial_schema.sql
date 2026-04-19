CREATE TYPE "public"."goal_type" AS ENUM('count', 'checklist', 'habit');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"title" text NOT NULL,
	"type" "goal_type" NOT NULL,
	"position" text DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "goals-select-own" ON "goals" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "goals-insert-own" ON "goals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "goals-update-own" ON "goals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "goals-delete-own" ON "goals" AS PERMISSIVE FOR DELETE TO "authenticated" USING (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "users-select-own" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING (id = auth.uid());--> statement-breakpoint
CREATE POLICY "users-update-own" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (id = auth.uid()) WITH CHECK (id = auth.uid());
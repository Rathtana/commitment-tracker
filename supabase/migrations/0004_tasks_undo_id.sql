ALTER TABLE "tasks" ADD COLUMN "last_undo_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "prior_is_done" boolean;
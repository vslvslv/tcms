DO $$ BEGIN
 CREATE TYPE "case_status" AS ENUM('draft', 'ready', 'approved');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "status" "case_status" DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "approved_by_id" uuid;
--> statement-breakpoint
ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "requirement_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"requirement_ref" text NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "requirement_links" ADD CONSTRAINT "requirement_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "requirement_links" ADD CONSTRAINT "requirement_links_case_id_test_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requirement_links_project_id_idx" ON "requirement_links" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requirement_links_case_id_idx" ON "requirement_links" USING btree ("case_id");

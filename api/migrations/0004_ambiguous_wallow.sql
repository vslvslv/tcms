CREATE TYPE "public"."case_template_type" AS ENUM('steps_based', 'exploratory');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template_type" "case_template_type" DEFAULT 'steps_based' NOT NULL,
	"default_steps" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_templates" ADD CONSTRAINT "case_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

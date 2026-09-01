CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"action_type" text NOT NULL,
	"description" text,
	"ref_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_charts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"config" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "role" text DEFAULT 'Roof Estimator';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
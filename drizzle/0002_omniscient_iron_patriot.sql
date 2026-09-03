CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_cost" numeric(15, 2),
	"reference_type" text,
	"reference_id" integer,
	"note" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "company_assets" ALTER COLUMN "purchase_cost" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "company_assets" ALTER COLUMN "purchase_cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "company_assets" ALTER COLUMN "current_value" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "company_assets" ALTER COLUMN "current_value" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "default_price" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "default_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "stock_qty" SET DATA TYPE numeric(15, 3);--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "stock_qty" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "min_stock" SET DATA TYPE numeric(15, 3);--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "min_stock" SET DEFAULT '10';--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "low_stock" SET DATA TYPE numeric(15, 3);--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "low_stock" SET DEFAULT '20';--> statement-breakpoint
ALTER TABLE "inventory_logs" ALTER COLUMN "qty" SET DATA TYPE numeric(15, 3);--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "qty" SET DATA TYPE numeric(15, 3);--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "unit_cost" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "total" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "transportation" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "transportation" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "discount_value" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "discount_value" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "stock_request_items" ALTER COLUMN "requested_qty" SET DATA TYPE numeric(15, 3);--> statement-breakpoint
ALTER TABLE "stock_request_items" ALTER COLUMN "approved_qty" SET DATA TYPE numeric(15, 3);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "entity_id" integer;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "before_data" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "after_data" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_agents_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
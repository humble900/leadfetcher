ALTER TABLE "leads" ALTER COLUMN "extraction_method" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "custom_limits" jsonb DEFAULT '{}'::jsonb;
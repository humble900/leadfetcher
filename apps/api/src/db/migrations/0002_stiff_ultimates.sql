ALTER TABLE "leads" ALTER COLUMN "extraction_method" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN IF EXISTS "address";
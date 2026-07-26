-- AlterTable
ALTER TABLE "structured_model_runs" ALTER COLUMN "status" SET DEFAULT 'pending',
ALTER COLUMN "updated_at" DROP DEFAULT;

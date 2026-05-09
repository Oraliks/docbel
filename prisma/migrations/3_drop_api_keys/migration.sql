-- DropForeignKey
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_createdBy_fkey";

-- DropTable
DROP TABLE IF EXISTS "ApiKey";

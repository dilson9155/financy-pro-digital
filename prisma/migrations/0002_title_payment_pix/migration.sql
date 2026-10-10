-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF_CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- AlterTable
ALTER TABLE "financial_titles"
  ADD COLUMN "paymentMethod" "SettlementMethod",
  ADD COLUMN "pixKeyType" "PixKeyType",
  ADD COLUMN "pixKey" TEXT;

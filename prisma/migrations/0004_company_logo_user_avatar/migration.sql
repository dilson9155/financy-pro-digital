-- Logo da empresa e foto do usuario (armazenados como data URL ou URL publica).
ALTER TABLE "companies" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT;

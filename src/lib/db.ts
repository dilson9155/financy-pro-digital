import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// ---------------------------------------------------------------------------
// Conexao com o banco via driver serverless do Neon (WebSocket sobre HTTPS/443).
//
// Muitas hospedagens compartilhadas (ex.: Hostinger) BLOQUEIAM conexoes de saida
// para portas nao-padrao, incluindo a 5432 do PostgreSQL. Isso faz o login e o
// cadastro falharem em producao com "Erro interno do servidor", mesmo com o
// banco acessivel de outra rede.
//
// O driver oficial do Neon contorna o bloqueio falando com o banco por `wss:`
// (porta 443, a mesma do HTTPS, que esta livre). Como o Node < 22 nao expoe um
// WebSocket global, informamos a implementacao do pacote `ws`.
//
// OBS.: o engine nativo do Prisma continua sendo usado apenas pelos comandos de
// CLI (migrations/seed), que rodam fora do ambiente de hospedagem.
// ---------------------------------------------------------------------------
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Cliente Prisma singleton.
 * Em desenvolvimento, o hot-reload do Next recarrega os modulos; guardamos a
 * instancia no escopo global para nao esgotar o pool de conexoes do Neon.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Tipo do cliente transacional usado dentro de prisma.$transaction. */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

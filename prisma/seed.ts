/**
 * Seed opcional do Financy Pro Digital.
 *
 * - SEMPRE cria (de forma idempotente) o administrador de sistema (super admin).
 * - Somente quando SEED_DEMO_DATA="true" cria uma empresa demo com estruturas
 *   e titulos de exemplo, util em desenvolvimento/QA. NUNCA ative em producao.
 *
 * Credenciais do admin sao controladas por variaveis de ambiente:
 *   SEED_ADMIN_EMAIL   (default: admin@financy.local)
 *   SEED_ADMIN_NAME    (default: Administrador do Sistema)
 *   SEED_ADMIN_PASSWORD(default: admin123456 -> troque!)
 *
 * Uso: npm run prisma:seed  (ou prisma db seed)
 */
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createCompanyForUser } from "@/services/companies";
import { createBankAccount, createCategory, createCostCenter, createPartner, createAccountPlan } from "@/services/structure";
import { createTitle } from "@/services/titles";
import { round2 } from "@/lib/money";

function envOr(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() !== "" ? v : fallback;
}

async function seedSuperAdmin() {
  const email = envOr("SEED_ADMIN_EMAIL", "admin@financy.local").toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.log(`[seed] Admin ${email} ja existe.`);
    return exists;
  }
  const password = envOr("SEED_ADMIN_PASSWORD", "admin123456");
  const user = await prisma.user.create({
    data: {
      name: envOr("SEED_ADMIN_NAME", "Administrador do Sistema"),
      email,
      passwordHash: await hashPassword(password),
      isSuperAdmin: true,
      status: "ACTIVE",
    },
  });
  console.log(
    `[seed] Super admin criado: ${email} (senha que sera trocada em producao).`,
  );
  return user;
}

/** Cria dados de demonstracao em uma empresa nova (uso interno/QA apenas). */
async function seedDemoData(adminId: string) {
  const company = await createCompanyForUser(adminId, {
    name: envOr("SEED_DEMO_COMPANY", "Empresa Demo LTDA"),
    document: envOr("SEED_DEMO_DOCUMENT", "00.000.000/0001-00"),
    email: "demo@financy.local",
  });
  console.log(`[seed] Empresa demo criada: ${company.name} (${company.id})`);

  // Estruturas financeiras de exemplo.
  const accountPlan = await createAccountPlan(company.id, adminId, {
    code: "1.1.1",
    name: "Caixa e equivalentes",
    type: "ASSET",
    isAnalytical: true,
    allowManual: true,
    active: true,
  });
  const category = await createCategory(company.id, adminId, {
    name: "Vendas",
    type: "INCOME",
    accountPlanId: accountPlan.id,
    active: true,
  });
  const categorySaida = await createCategory(company.id, adminId, {
    name: "Despesas operacionais",
    type: "EXPENSE",
    active: true,
  });
  const costCenter = await createCostCenter(company.id, adminId, {
    code: "CC-01",
    name: "Administrativo",
    active: true,
  });
  const partnerCliente = await createPartner(company.id, adminId, {
    type: "CUSTOMER",
    name: "Cliente Exemplo",
    document: "123.456.789-00",
    active: true,
  });
  const partnerFornecedor = await createPartner(company.id, adminId, {
    type: "SUPPLIER",
    name: "Fornecedor Exemplo",
    active: true,
  });

  // Conta com saldo inicial (entra no ledger como lancamento de abertura).
  const account = await createBankAccount(company.id, adminId, {
    name: "Conta corrente - Banco X",
    type: "BANK",
    bankName: "Banco X",
    bankCode: "001",
    agency: "0001",
    accountNumber: "12345-6",
    accountPlanId: accountPlan.id,
    currency: "BRL",
    initialBalance: "10000.00",
    postOpeningBalance: true,
    active: true,
  });

  const today = new Date();
  const daysFromNow = (n: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);

  // Titulos de exemplo (contas a receber e a pagar) com parcelas.
  await createTitle(company.id, adminId, {
    direction: "RECEIVABLE",
    partnerId: partnerCliente.id,
    documentNumber: "NF-2026-0001",
    description: "Venda de servicos - contrato anual",
    issueDate: daysFromNow(-10),
    totalAmount: "3600.00",
    categoryId: category.id,
    costCenterId: costCenter.id,
    accountPlanId: accountPlan.id,
    notes: "Seed de demonstracao.",
    installments: [
      { dueDate: daysFromNow(20), amount: "1200.00" },
      { dueDate: daysFromNow(50), amount: "1200.00" },
      { dueDate: daysFromNow(80), amount: "1200.00" },
    ],
  });

  await createTitle(company.id, adminId, {
    direction: "PAYABLE",
    partnerId: partnerFornecedor.id,
    documentNumber: "BOL-000123",
    description: "Aluguel do escritorio",
    issueDate: daysFromNow(-5),
    totalAmount: "1800.00",
    categoryId: categorySaida.id,
    costCenterId: costCenter.id,
    accountPlanId: accountPlan.id,
    installments: [{ dueDate: daysFromNow(10), amount: "1800.00" }],
  });

  console.log(
    `[seed] Dados demo criados: plano de contas, categorias, centros, parceiros, conta (saldo ${round2(account.currentBalance).toFixed(2)}) e titulos.`,
  );
}

async function main() {
  const admin = await seedSuperAdmin();

  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoData(admin.id);
  } else {
    console.log(
      "[seed] SEED_DEMO_DATA nao ativo - nenhum dado de demonstracao foi criado.",
    );
  }

  console.log("[seed] Concluido.");
}

main()
  .catch((err) => {
    console.error("[seed] Falhou:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
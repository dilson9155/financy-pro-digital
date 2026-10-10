import { describe, expect, it } from "vitest";
import {
  buildAgingDocument,
  buildCashFlowDocument,
  buildGroupDocument,
  buildIncomeStatementDocument,
  buildPositionsDocument,
  buildTitlesDocument,
  type AgingData,
  type CashFlowData,
  type GroupRow,
  type IncomeStatementData,
  type PositionsData,
  type TitleReportData,
} from "@/lib/report-documents";
import { formatCurrency, formatPercent } from "@/lib/format";

const period = {
  from: "2026-01-01T12:00:00.000Z",
  to: "2026-01-31T12:00:00.000Z",
};

describe("buildGroupDocument", () => {
  const rows: GroupRow[] = [
    { id: "a", name: "Vendas", inflow: "1000.00", outflow: "0.00", net: "1000.00", count: 3 },
    { id: "b", name: "Despesas", inflow: "0.00", outflow: "400.00", net: "-400.00", count: 2 },
  ];

  it("monta cabecalho, destaques e detalhamento", () => {
    const doc = buildGroupDocument("category", rows, period);

    expect(doc.title).toBe("Resultado por categoria");
    expect(doc.subtitle).toContain("Período:");
    expect(doc.summary).toEqual([
      { label: "Entradas", value: formatCurrency("1000.00") },
      { label: "Saídas", value: formatCurrency("400.00") },
      { label: "Resultado", value: formatCurrency(600) },
    ]);

    const section = doc.sections[0];
    expect(section.columns[0]).toBe("Categoria");
    expect(section.rows[0][0]).toBe("Vendas");
    expect(section.rows[0][1]).toBe(formatCurrency("1000.00"));
    expect(section.rows[0][4]).toBe("3");
    expect(section.align?.[1]).toBe("right");
  });

  it("usa rotulo de centro de custo quando solicitado", () => {
    const doc = buildGroupDocument("cost-center", rows, period);
    expect(doc.title).toBe("Resultado por centro de custo");
    expect(doc.sections[0].columns[0]).toBe("Centro de custo");
  });

  it("nao divide por zero quando nao ha movimentacao", () => {
    const doc = buildGroupDocument("category", [], period);
    expect(doc.summary?.[2].value).toBe(formatCurrency(0));
    expect(doc.sections[0].rows).toHaveLength(0);
  });
});

describe("buildAgingDocument", () => {
  const data: AgingData = {
    overdue: "500.00",
    dueToday: "100.00",
    due7: "200.00",
    due30: "300.00",
    dueLater: "400.00",
    total: "1500.00",
  };

  it("mapeia as faixas de vencimento", () => {
    const doc = buildAgingDocument(data, "PAYABLE");
    expect(doc.title).toBe("Vencimentos — contas a pagar");
    expect(doc.summary?.[2]).toEqual({
      label: "Total em aberto",
      value: formatCurrency("1500.00"),
    });
    const rows = doc.sections[0].rows;
    expect(rows.map((r) => r[0])).toEqual([
      "Vencidos",
      "Vencem hoje",
      "Até 7 dias",
      "Até 30 dias",
      "Depois de 30 dias",
      "Total em aberto",
    ]);
    expect(rows[0][1]).toBe(formatCurrency("500.00"));
  });
});

describe("buildPositionsDocument", () => {
  const data: PositionsData = {
    total: "2500.00",
    items: [
      {
        id: "1",
        name: "Caixa",
        type: "CASH",
        currency: "BRL",
        initialBalance: "0.00",
        currentBalance: "2500.00",
        calculatedBalance: "2500.00",
        divergence: "0.00",
        active: true,
      },
    ],
  };

  it("lista contas com saldos e situacao", () => {
    const doc = buildPositionsDocument(data);
    expect(doc.summary?.[0].value).toBe(formatCurrency("2500.00"));
    expect(doc.sections[0].rows[0]).toEqual([
      "Caixa",
      "Caixa",
      formatCurrency("2500.00"),
      formatCurrency("2500.00"),
      formatCurrency("0.00"),
      "Ativa",
    ]);
  });
});

describe("buildTitlesDocument", () => {
  const data: TitleReportData = {
    direction: "PAYABLE",
    items: [
      {
        id: "t1",
        partner: "Fornecedor X",
        category: "Insumos",
        description: "Compra de material",
        documentNumber: "NF-1",
        dueDate: "2026-01-10T12:00:00.000Z",
        issueDate: "2026-01-01T12:00:00.000Z",
        totalAmount: "500.00",
        settledAmount: "100.00",
        openAmount: "400.00",
        status: "OPEN",
        overdue: true,
      },
    ],
    summary: {
      count: 1,
      totalAmount: "500.00",
      settledAmount: "100.00",
      openAmount: "400.00",
      overdueAmount: "400.00",
    },
  };

  it("monta a relacao de contas a pagar", () => {
    const doc = buildTitlesDocument(data, period);
    expect(doc.title).toBe("Contas a pagar");
    const row = doc.sections[0].rows[0];
    expect(row[0]).toBe("Fornecedor X");
    expect(row[1]).toBe("Compra de material");
    expect(row[6]).toContain("vencido");
  });

  it("usa o titulo de contas a receber", () => {
    const doc = buildTitlesDocument({ ...data, direction: "RECEIVABLE" }, period);
    expect(doc.title).toBe("Contas a receber");
  });
});

describe("buildIncomeStatementDocument", () => {
  const data: IncomeStatementData = {
    revenues: [{ id: "r", name: "Serviços", amount: "1000.00", count: 4 }],
    expenses: [{ id: "e", name: "Aluguel", amount: "300.00", count: 1 }],
    totalRevenue: "1000.00",
    totalExpense: "300.00",
    net: "700.00",
    margin: "70.00",
    revenueCount: 4,
    expenseCount: 1,
  };

  it("gera as secoes de receitas, despesas e resultado", () => {
    const doc = buildIncomeStatementDocument(data, period);
    expect(doc.sections).toHaveLength(3);
    expect(doc.summary?.[2]).toEqual({
      label: "Resultado",
      value: formatCurrency("700.00"),
    });
    expect(doc.summary?.[3].value).toBe(formatPercent(70));
    const resultado = doc.sections[2].rows;
    expect(resultado[2]).toEqual([
      "(=) Resultado líquido",
      formatCurrency("700.00"),
    ]);
  });
});

describe("buildCashFlowDocument", () => {
  const data: CashFlowData = {
    period: { from: period.from, to: period.to },
    opening: "0.00",
    inflow: "1000.00",
    outflow: "400.00",
    net: "600.00",
    closing: "600.00",
    rows: [
      {
        id: "x",
        date: "2026-01-05T12:00:00.000Z",
        description: "Recebimento",
        type: "INFLOW",
        origin: "RECEIVABLE_SETTLEMENT",
        amount: "1000.00",
        bankAccount: "Caixa",
        category: "Vendas",
        costCenter: null,
        balance: "1000.00",
      },
    ],
    daily: [
      { date: "2026-01-05", inflow: "1000.00", outflow: "0.00", net: "1000.00" },
    ],
  };

  it("resume saldos e lista lancamentos", () => {
    const doc = buildCashFlowDocument(data, period);
    expect(doc.title).toBe("Movimento de caixa");
    expect(doc.summary).toEqual([
      { label: "Saldo inicial", value: formatCurrency("0.00") },
      { label: "Entradas", value: formatCurrency("1000.00") },
      { label: "Saídas", value: formatCurrency("400.00") },
      { label: "Resultado", value: formatCurrency("600.00") },
      { label: "Saldo final", value: formatCurrency("600.00") },
    ]);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[1].rows[0][1]).toBe("Recebimento");
  });
});

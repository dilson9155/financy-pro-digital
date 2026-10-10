"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiQuery } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  TITLE_STATUS_LABELS,
} from "@/lib/format";
import { RefreshCw } from "lucide-react";

interface OverdueItem {
  id: string;
  direction: string;
  description: string;
  documentNumber: string | null;
  dueDate: string;
  daysOverdue: number;
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  totalAmount: string;
  settledAmount: string;
  openAmount: string;
  status: string;
  partner: { id: string; name: string; document: string | null } | null;
  category: { id: string; name: string } | null;
}

interface BucketSummary {
  key: OverdueItem["bucket"];
  label: string;
  count: number;
  amount: string;
}

interface DirectionSummary {
  count: number;
  amount: string;
}

interface Summary {
  totalCount: number;
  totalAmount: string;
  byBucket: BucketSummary[];
  byDirection: {
    PAYABLE: DirectionSummary;
    RECEIVABLE: DirectionSummary;
  };
}

interface ScanResponse {
  items: OverdueItem[];
  summary: Summary;
  scannedAt: string;
}

const BUCKET_TONES: Record<OverdueItem["bucket"], "primary" | "warning" | "destructive" | "default"> = {
  "0-30": "primary",
  "31-60": "warning",
  "61-90": "destructive",
  "90+": "destructive",
};

const BUCKET_BADGE_TONES: Record<OverdueItem["bucket"], "blue" | "yellow" | "red" | "purple"> = {
  "0-30": "blue",
  "31-60": "yellow",
  "61-90": "red",
  "90+": "purple",
};

export function OverdueTitlesView() {
  const { notify } = useToast();
  const [scanning, setScanning] = useState(false);

  const { data, loading, error, reload } = useApiQuery<ScanResponse>(
    "/api/titles/overdue",
  );

  async function runScan() {
    setScanning(true);
    try {
      await reload();
      notify("Varredura concluída.", "success");
    } finally {
      setScanning(false);
    }
  }

  const scannedAt = data?.scannedAt
    ? new Date(data.scannedAt).toLocaleString("pt-BR")
    : "—";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Títulos vencidos"
        description="Varredura dos títulos em aberto/parcial com data de vencimento anterior a hoje."
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <span className="text-xs text-muted-foreground">
              Última varredura: {scannedAt}
            </span>
            <Button onClick={runScan} disabled={scanning}>
              {scanning ? <Spinner /> : <RefreshCw className="mr-1 h-4 w-4" />}
              Rodar varredura
            </Button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground">
        Inclui contas a pagar e a receber. Mostra apenas títulos não
        liquidados cujo vencimento é anterior a hoje.
      </p>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <EmptyState
          title="Erro ao carregar"
          description={error}
          action={
            <button onClick={reload} className="text-primary">
              Tentar novamente
            </button>
          }
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Nenhum título vencido"
          description="Ótima notícia: não há títulos em aberto (pagar ou receber) com vencimento anterior a hoje."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total vencido"
              value={formatCurrency(data.summary.totalAmount)}
              hint={`${data.summary.totalCount} título(s)`}
              tone="destructive"
            />
            <StatCard
              label="A receber (vencido)"
              value={formatCurrency(data.summary.byDirection.RECEIVABLE.amount)}
              hint={`${data.summary.byDirection.RECEIVABLE.count} título(s) — clientes que devem`}
              tone="primary"
            />
            <StatCard
              label="A pagar (vencido)"
              value={formatCurrency(data.summary.byDirection.PAYABLE.amount)}
              hint={`${data.summary.byDirection.PAYABLE.count} título(s) — fornecedores a pagar`}
              tone="warning"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.summary.byBucket.map((b) => (
              <StatCard
                key={b.key}
                label={b.label}
                value={String(b.count)}
                hint={b.count > 0 ? formatCurrency(b.amount) : "Sem títulos"}
                tone={BUCKET_TONES[b.key]}
              />
            ))}
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {data.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/contas-a-${
                            item.direction === "RECEIVABLE" ? "receber" : "pagar"
                          }/${item.id}`}
                          className="font-medium hover:underline"
                        >
                          {item.description}
                        </Link>
                        <Badge tone="gray" className="text-[10px]">
                          {item.direction === "RECEIVABLE"
                            ? "A receber"
                            : "A pagar"}
                        </Badge>
                        {item.status === "PARTIAL" ? (
                          <Badge tone="yellow" className="text-[10px]">
                            {TITLE_STATUS_LABELS.PARTIAL}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.partner ? (
                          <>{item.partner.name} · </>
                        ) : null}
                        Venceu em {formatDate(item.dueDate)}
                        {item.documentNumber
                          ? ` · Doc ${item.documentNumber}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-row-reverse">
                      <div className="text-right">
                        <p className="text-base font-bold">
                          {formatCurrency(item.openAmount)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          restante de {formatCurrency(item.totalAmount)}
                        </p>
                      </div>
                      <Badge tone={BUCKET_BADGE_TONES[item.bucket]}>
                        {item.daysOverdue} dia(s)
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

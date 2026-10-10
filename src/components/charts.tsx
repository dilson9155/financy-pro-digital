"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function currency(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export function CashFlowChart({
  data,
}: {
  data: { label: string; inflow: string; outflow: string; net: string }[];
}) {
  const rows = data.map((d) => ({
    label: d.label,
    Entradas: Number(d.inflow),
    Saídas: Number(d.outflow),
    Líquido: Number(d.net),
  }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => currency(Number(v))} width={90} />
        <Tooltip formatter={(v: number) => currency(v)} />
        <Legend />
        <Bar dataKey="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NetLineChart({
  data,
}: {
  data: { label: string; net: string }[];
}) {
  const rows = data.map((d) => ({ label: d.label, Líquido: Number(d.net) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => currency(Number(v))} width={90} />
        <Tooltip formatter={(v: number) => currency(v)} />
        <Line type="monotone" dataKey="Líquido" stroke="#2563eb" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryPie({
  data,
}: {
  data: { name: string; outflow: string }[];
}) {
  const rows = data
    .map((d) => ({ name: d.name, value: Number(d.outflow) }))
    .filter((d) => d.value > 0)
    .slice(0, 8);
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Sem dados no período.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => currency(v)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

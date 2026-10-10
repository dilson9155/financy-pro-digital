"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ChevronDown,
  DatabaseBackup,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "./ui";
import { BrandSidebar } from "./brand";
import { api } from "@/lib/client";
import {
  SessionProvider,
  useCan,
  useSession,
  type SessionValue,
} from "./session-context";
import { ToastProvider } from "./toast";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Visão geral",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
    ],
  },
  {
    group: "Financeiro",
    items: [
      {
        href: "/contas-a-pagar",
        label: "Contas a pagar",
        icon: TrendingDown,
        permission: "payables.view",
      },
      {
        href: "/contas-a-receber",
        label: "Contas a receber",
        icon: TrendingUp,
        permission: "receivables.view",
      },
      {
        href: "/lancamentos",
        label: "Lançamentos",
        icon: Receipt,
        permission: "transactions.view",
      },
      {
        href: "/transferencias",
        label: "Transferências",
        icon: ArrowLeftRight,
        permission: "transfers.view",
      },
      {
        href: "/conciliacao",
        label: "Conciliação",
        icon: Wand2,
        permission: "reconciliation.view",
      },
    ],
  },
  {
    group: "Análise",
    items: [
      {
        href: "/fluxo-de-caixa",
        label: "Fluxo de caixa",
        icon: Wallet,
        permission: "cash_flow.view",
      },
      {
        href: "/relatorios",
        label: "Relatórios",
        icon: BarChart3,
        permission: "reports.view",
      },
    ],
  },
  {
    group: "Cadastros",
    items: [
      {
        href: "/contas-bancarias",
        label: "Contas e caixas",
        icon: Building2,
        permission: "bank_accounts.manage",
      },
      {
        href: "/categorias",
        label: "Categorias",
        icon: Tags,
        permission: "categories.manage",
      },
      {
        href: "/plano-de-contas",
        label: "Plano de contas",
        icon: ListTree,
        permission: "account_plan.manage",
      },
      {
        href: "/centros-de-custo",
        label: "Centros de custo",
        icon: Building2,
        permission: "cost_centers.manage",
      },
      {
        href: "/parceiros",
        label: "Fornecedores / clientes",
        icon: Users,
        permission: "partners.manage",
      },
    ],
  },
  {
    group: "Administração",
    items: [
      {
        href: "/usuarios",
        label: "Usuários",
        icon: Users,
        permission: "users.view",
      },
      {
        href: "/papeis",
        label: "Papéis e permissões",
        icon: ShieldCheck,
        permission: "users.view",
      },
      {
        href: "/auditoria",
        label: "Auditoria",
        icon: ScrollText,
        permission: "audit.view",
      },
      {
        href: "/configuracoes",
        label: "Configurações",
        icon: Settings,
        permission: "settings.manage",
      },
      {
        href: "/backups",
        label: "Backups",
        icon: DatabaseBackup,
        permission: "backups.view",
      },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const can = useCan();
  const session = useSession();

  return (
    <div className="flex h-full flex-col">
      <BrandSidebar />
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(i.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.group}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground">
        <p className="truncate">{session.user.email}</p>
      </div>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const session = useSession();
  const [switching, setSwitching] = useState(false);

  async function switchCompany(companyId: string) {
    setSwitching(true);
    try {
      await api.post("/api/companies/active", { companyId });
      router.refresh();
      router.push("/dashboard");
    } finally {
      setSwitching(false);
    }
  }

  async function logout() {
    await api.post("/api/auth/logout");
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-md p-2 hover:bg-accent md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative">
          <select
            value={session.companyId}
            disabled={switching}
            onChange={(e) => switchCompany(e.target.value)}
            className="h-9 appearance-none rounded-md border bg-background pl-3 pr-8 text-sm font-medium focus-ring"
            aria-label="Empresa ativa"
          >
            {session.memberships.map((m) => (
              <option key={m.companyId} value={m.companyId}>
                {m.companyName}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{session.user.name}</p>
          <p className="text-xs text-muted-foreground">
            {session.memberships.find((m) => m.companyId === session.companyId)
              ?.roleName ?? "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-md border p-2 text-muted-foreground hover:bg-accent"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export function AppShell({
  session,
  children,
}: {
  session: SessionValue;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SessionProvider value={session}>
      <ToastProvider>
      <div className="flex min-h-screen">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
          <div className="sticky top-0 h-screen">
            <SidebarContent />
          </div>
        </aside>

        {/* Sidebar mobile */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="animate-fade-in absolute left-0 top-0 h-full w-64 border-r bg-card">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-2 top-4 rounded-md p-1 hover:bg-accent"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
      </ToastProvider>
    </SessionProvider>
  );
}

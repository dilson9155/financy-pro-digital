"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "./ui";
import { formatDateTime } from "@/lib/format";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface ListResponse {
  items: NotificationItem[];
  unreadCount: number;
}

const POLL_MS = 30000;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ListResponse>({ items: [], unreadCount: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ListResponse>("/api/notifications");
      setData(res);
    } catch {
      /* silencioso: o sininho nao deve atrapalhar o uso */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function openItem(item: NotificationItem) {
    setOpen(false);
    if (!item.readAt) {
      setData((d) => ({
        ...d,
        unreadCount: Math.max(0, d.unreadCount - 1),
        items: d.items.map((x) =>
          x.id === item.id ? { ...x, readAt: new Date().toISOString() } : x,
        ),
      }));
      try {
        await api.post("/api/notifications/read", { ids: [item.id] });
      } catch {
        /* ignora */
      }
    }
    if (item.link) router.push(item.link);
  }

  async function markAll() {
    const now = new Date().toISOString();
    setData((d) => ({
      ...d,
      unreadCount: 0,
      items: d.items.map((x) => ({ ...x, readAt: x.readAt ?? now })),
    }));
    try {
      await api.post("/api/notifications/read", { all: true });
    } catch {
      /* ignora */
    }
  }

  const { items, unreadCount } = data;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
        className="relative rounded-md border p-2 text-muted-foreground hover:bg-accent"
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <p className="text-sm font-semibold">Notificações</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="text-xs text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação por aqui.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent",
                    !n.readAt && "bg-primary/5",
                  )}
                >
                  <div className="flex w-full items-center gap-2">
                    {!n.readAt ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                    <span className="flex-1 truncate text-sm font-medium">
                      {n.title}
                    </span>
                  </div>
                  {n.body ? (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

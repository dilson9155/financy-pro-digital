"use client";

import { Input, Label, Select, Button, cn } from "./ui";

export interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number";
  options?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export type FilterValues = Record<string, string>;

/**
 * Barra de filtros dinamicos e combinaveis. Cada campo e independente e o
 * conjunto e aplicado simultaneamente (AND) na consulta a API.
 */
export function FilterBar({
  fields,
  values,
  onChange,
  onSubmit,
  onReset,
  loading,
}: {
  fields: FilterField[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onSubmit?: () => void;
  onReset?: () => void;
  loading?: boolean;
}) {
  function set(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  const hasActive = Object.values(values).some((v) => v !== "");

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.key} className={cn("flex flex-col gap-1.5", f.className)}>
            <Label className="text-xs">{f.label}</Label>
            {f.type === "select" ? (
              <Select
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
              >
                <option value="">Todos</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && onSubmit) onSubmit();
                }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {hasActive ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const cleared: FilterValues = {};
              for (const f of fields) cleared[f.key] = "";
              onChange(cleared);
              onReset?.();
            }}
          >
            Limpar
          </Button>
        ) : null}
        {onSubmit ? (
          <Button size="sm" onClick={onSubmit} disabled={loading}>
            Aplicar filtros
          </Button>
        ) : null}
      </div>
    </div>
  );
}

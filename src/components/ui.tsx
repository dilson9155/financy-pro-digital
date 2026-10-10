import { twMerge } from "tailwind-merge";
import clsx, { type ClassValue } from "clsx";
import { ResponsiveTable } from "@/components/table-responsive";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// -----------------------------------------------------------------------------
// Layout primitives
// -----------------------------------------------------------------------------

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex flex-col gap-1 p-5", className)}>{children}</div>;
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={cn("text-base font-semibold leading-none", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  );
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-5 pt-0", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Button
// -----------------------------------------------------------------------------

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-9 w-9",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={buttonClasses(variant, size, className)} {...props} />
  );
}

// -----------------------------------------------------------------------------
// Form primitives
// -----------------------------------------------------------------------------

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    />
  );
}

const fieldBase =
  "flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, "h-auto min-h-[72px] py-2", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {hint && !error ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Badge / status
// -----------------------------------------------------------------------------

type BadgeTone = "gray" | "blue" | "green" | "red" | "yellow" | "purple" | "teal";

const badgeTones: Record<BadgeTone, string> = {
  gray: "bg-muted text-muted-foreground",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-amber-100 text-amber-700",
  purple: "bg-purple-100 text-purple-700",
  teal: "bg-teal-100 text-teal-700",
};

export function Badge({
  tone = "gray",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const avatarSizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Foto do usuario com fallback em monograma (iniciais do nome). */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  const base = cn(
    "grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary",
    avatarSizes[size],
    className,
  );

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={cn(base, "object-cover")} />
    );
  }

  return (
    <span aria-hidden="true" className={base}>
      {initials(name)}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  OPEN: "blue",
  PARTIAL: "yellow",
  PAID: "green",
  CANCELED: "gray",
  REVERSED: "purple",
  POSTED: "green",
  COMPLETED: "green",
  PENDING: "yellow",
  MATCHED: "green",
  IGNORED: "gray",
  ADJUSTED: "blue",
  RUNNING: "blue",
  FAILED: "red",
  ACTIVE: "green",
  INACTIVE: "gray",
  LOCKED: "red",
  SUSPENDED: "yellow",
  OVERDUE: "red",
  INVITED: "blue",
};

export function statusTone(status: string | null | undefined): BadgeTone {
  if (!status) return "gray";
  return STATUS_TONES[status] ?? "gray";
}

// -----------------------------------------------------------------------------
// Table
// -----------------------------------------------------------------------------

export function Table({ children }: { children: React.ReactNode }) {
  return <ResponsiveTable>{children}</ResponsiveTable>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b bg-muted/40 text-muted-foreground">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
}

export function TR({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("transition-colors hover:bg-muted/40", className)}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-xs font-semibold uppercase tracking-wide",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "destructive" | "warning" | "primary";
  icon?: React.ReactNode;
}) {
  const toneClass: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-600",
    destructive: "text-red-600",
    warning: "text-amber-600",
    primary: "text-primary",
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tracking-tight", toneClass[tone])}>
          {value}
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

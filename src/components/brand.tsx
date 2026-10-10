import Link from "next/link";
import { BRAND } from "@/lib/branding";
import { cn } from "./ui";

/**
 * Marca do sistema (logo). Renderiza a imagem configurada em `BRAND.logo`
 * ou, na ausencia dela, o monograma de texto. Use `size="lg"` nas telas de
 * autenticacao (login/cadastro) e o padrao nos demais lugares.
 */
export function BrandMark({
  size = "sm",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const box =
    size === "sm"
      ? "h-8 w-8 rounded-md text-sm"
      : "h-12 w-12 rounded-xl text-xl";

  if (BRAND.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={BRAND.logo}
        alt={BRAND.logoAlt}
        className={cn(box, "shrink-0 object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        "grid shrink-0 place-items-center bg-primary font-bold text-primary-foreground",
        className,
      )}
    >
      {BRAND.monogram}
    </span>
  );
}

/**
 * Cabecalho de marca da barra lateral (link para o dashboard).
 * Se a empresa ativa tiver logo cadastrada, ela substitui a marca do sistema.
 */
export function BrandSidebar({
  logoUrl,
  companyName,
}: {
  logoUrl?: string | null;
  companyName?: string | null;
} = {}) {
  const showCompany = Boolean(logoUrl);
  return (
    <Link href="/dashboard" className="flex h-16 items-center gap-2 border-b px-5">
      {showCompany ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl as string}
          alt={companyName ?? "Logo da empresa"}
          className="h-8 w-8 shrink-0 rounded-md object-contain"
        />
      ) : (
        <BrandMark />
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold">
          {companyName || BRAND.shortName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {companyName ? BRAND.shortName : BRAND.shortNameSuffix}
        </p>
      </div>
    </Link>
  );
}

/**
 * Cabecalho de marca das telas de autenticacao (logo + titulo + subtitulo).
 */
export function BrandAuthHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <BrandMark size="lg" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

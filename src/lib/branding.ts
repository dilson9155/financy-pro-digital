/**
 * Configuracao central de marca do sistema.
 *
 * Para trocar a logo:
 *   1. Coloque o arquivo de imagem dentro da pasta `public/`
 *      (ex.: `public/logo.svg` ou `public/logo.png`).
 *   2. Aponte `logo` para o caminho publico do arquivo (ex.: "/logo.png").
 *   3. Deixe `logo` = null para usar o monograma de texto (fallback).
 *
 * O componente `<BrandMark />` e usado na barra lateral, no login e no
 * cadastro, entao a troca vale para todo o sistema de uma unica vez.
 */
export const BRAND = {
  /** Nome completo (usado no login e no titulo da aba). */
  name: "Financy Pro Digital",
  /** Nome curto exibido na barra lateral (linha 1). */
  shortName: "Financy Pro",
  /** Complemento exibido na barra lateral (linha 2). */
  shortNameSuffix: "Digital",
  /** Descricao usada no <title> da pagina. */
  description:
    "SaaS de gestão financeira empresarial: contas a pagar e receber, fluxo de caixa, conciliação e relatórios.",
  /** Caminho da imagem da logo em /public, ou null para usar o monograma. */
  logo: "/logo.png" as string | null,
  /** Texto alternativo (acessibilidade) da imagem da logo. */
  logoAlt: "Financy Pro Digital",
  /** Monograma de fallback quando nao ha imagem configurada. */
  monogram: "F",
};

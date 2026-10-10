"use client";

/**
 * Utilitarios de imagem no navegador: le um arquivo escolhido pelo usuario,
 * redimensiona (para manter o data URL pequeno) e devolve como data URL.
 * Usado na logo da empresa e na foto do usuario.
 */

/** Limite de tamanho do data URL aceito pelo servidor (mesmo da validacao). */
export const MAX_IMAGE_DATA_URL = 2_000_000;

export interface ImageResizeOptions {
  /** Maior dimensao (largura ou altura) da imagem resultante. */
  maxDimension?: number;
  /**
   * Formato de saida. PNG preserva transparencia (recomendado para logo);
   * JPEG gera arquivos menores (recomendado para foto).
   */
  format?: "image/png" | "image/jpeg";
  /** Qualidade para JPEG (0 a 1). */
  quality?: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
    img.src = src;
  });
}

/**
 * Converte um arquivo de imagem em data URL redimensionado.
 * Lanca erro com mensagem amigavel em caso de arquivo invalido ou grande demais.
 */
export async function fileToDataUrl(
  file: File,
  options: ImageResizeOptions = {},
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem (PNG ou JPEG).");
  }

  const { maxDimension = 512, format = "image/png", quality = 0.9 } = options;
  const original = await readFileAsDataUrl(file);
  const img = await loadImage(original);

  const largest = Math.max(img.width, img.height) || 1;
  const scale = Math.min(1, maxDimension / largest);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Navegador não suporta processamento de imagem.");
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL(format, quality);
  if (dataUrl.length > MAX_IMAGE_DATA_URL) {
    throw new Error("Imagem muito grande. Escolha um arquivo menor.");
  }
  return dataUrl;
}

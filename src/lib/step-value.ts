/**
 * Soma um passo e prende o resultado na faixa. Passo 0 serve para so
 * normalizar um valor que veio do campo digitavel, que pode estar fora da
 * faixa ou vazio (NaN).
 */
export function stepValue(
  current: number,
  delta: number,
  min: number,
  max: number,
): number {
  const base = Number.isFinite(current) ? current : min
  return Math.min(max, Math.max(min, base + delta))
}

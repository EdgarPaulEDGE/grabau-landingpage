/**
 * Gibt eine Zahl im deutschen Format aus (Tausenderpunkt).
 * Bewusst statisch gerendert: garantiert sichtbar, kein JS/rAF nötig.
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const formatted = value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return <span>{formatted}</span>;
}

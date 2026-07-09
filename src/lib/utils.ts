/** Kleiner Klassen-Helfer: verbindet nur die "wahren" Klassennamen. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

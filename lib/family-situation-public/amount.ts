/** Parse a non-negative monthly amount entered with a comma or a dot and optional grouped spaces. */
export function parseFamilySituationAmount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const text = value.trim()
  if (!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/.test(text)) return undefined
  const amount = Number(text.replace(/[ \u00a0\u202f]/g, "").replace(",", "."))
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined
}

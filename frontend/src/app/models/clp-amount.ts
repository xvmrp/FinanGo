/** CLP amounts are whole pesos; dots and commas may only group thousands. */
export function parseClpAmount(value: string): number | null {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+)$/.test(text)) return null;
  const amount = Number(text.replace(/[.,]/g, ''));
  return Number.isSafeInteger(amount) && amount <= 2147483647 ? amount : null;
}

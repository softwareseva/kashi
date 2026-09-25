/** Time-sortable, URL-safe ids: `<prefix>_<base36 ms><12 random hex>`. */
export function newId(prefix: string): string {
  const time = Date.now().toString(36).padStart(9, "0");
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  return `${prefix}_${time}${random}`;
}

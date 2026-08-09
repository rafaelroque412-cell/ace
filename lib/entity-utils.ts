// Normalización de entidades para comparación robusta entre
// expedientes_archivo.oficina (texto libre) y profiles.entity.

export function normalizeEntity(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function entitiesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeEntity(a);
  const nb = normalizeEntity(b);
  return na !== "" && nb !== "" && na === nb;
}

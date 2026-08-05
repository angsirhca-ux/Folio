/**
 * Claude / tool JSON sometimes returns a single object or keyed map
 * instead of an array. Coerce anything array-like into T[].
 */
export function asObjectArray<T extends object>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw.filter((item) => item != null && typeof item === "object") as T[];
  }
  if (!raw || typeof raw !== "object") return [];

  const record = raw as Record<string, unknown>;
  const values = Object.values(record);
  if (
    values.length > 0 &&
    values.every((v) => v != null && typeof v === "object" && !Array.isArray(v))
  ) {
    // Keyed map: { "0": {...}, "1": {...} } or { flag1: {...} }
    return values as T[];
  }

  // Single flag / memory note object
  if ("excerpt" in record || "text" in record || "note" in record || "category" in record) {
    return [raw as T];
  }

  return [];
}

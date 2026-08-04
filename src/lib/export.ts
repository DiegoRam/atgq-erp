import type { Cell, Row } from "write-excel-file/browser";

/**
 * Convierte un valor crudo en una celda de write-excel-file preservando su
 * tipo. Es importante NO pasar todo como texto: xlsx conservaba los números
 * como números, y volcarlos como string rompería ordenamientos y sumas al
 * abrir el archivo en Excel.
 */
function toCell(value: unknown): Cell {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { value, type: Number }
      : { value: String(value), type: String };
  }
  if (typeof value === "boolean") return { value, type: Boolean };
  if (value instanceof Date) return { value, type: Date };
  return { value: String(value), type: String };
}

export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName: string,
  headers: { key: string; label: string }[],
): Promise<void> {
  try {
    const { default: writeXlsxFile } = await import(
      "write-excel-file/browser"
    );

    const headerRow: Row = headers.map((h) => ({
      value: h.label,
      type: String,
      fontWeight: "bold" as const,
    }));

    const dataRows: Row[] = data.map((row) =>
      headers.map((h) => toCell(row[h.key])),
    );

    // Auto column widths (en caracteres, misma unidad que el `wch` de xlsx)
    const columns = headers.map((h) => ({
      width: Math.max(
        h.label.length,
        ...data.map((r) => String(r[h.key] ?? "").length),
        10,
      ),
    }));

    await writeXlsxFile([headerRow, ...dataRows], {
      sheet: sheetName,
      columns,
      // Obligatorio: write-excel-file lanza si una celda `Date` no tiene
      // formato (propio o global). Hoy Supabase devuelve las fechas como
      // strings ISO, pero sin esto un solo Date real romperia la exportacion.
      dateFormat: "dd/mm/yyyy",
    }).toFile(`${filename}.xlsx`);
  } catch {
    throw new Error("Error al generar el archivo Excel");
  }
}

export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName: string,
  headers: { key: string; label: string }[],
): Promise<void> {
  try {
    const XLSX = await import("xlsx");

    const rows = data.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const h of headers) {
        obj[h.label] = row[h.key] ?? "";
      }
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto column widths
    ws["!cols"] = headers.map((h) => ({
      wch: Math.max(
        h.label.length,
        ...rows.map((r) => String(r[h.label] ?? "").length),
        10,
      ),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } catch {
    throw new Error("Error al generar el archivo Excel");
  }
}

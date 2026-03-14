import { format, differenceInYears, differenceInMonths, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy", { locale: es });
}

export function formatAntiguedad(fechaAlta: string | Date | null | undefined): string {
  if (!fechaAlta) return "—";
  const from = typeof fechaAlta === "string" ? new Date(fechaAlta) : fechaAlta;
  const now = new Date();
  const years = differenceInYears(now, from);
  const months = differenceInMonths(now, from) % 12;
  const days = differenceInDays(now, from) % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}a`);
  if (months > 0) parts.push(`${months}m`);
  if (days > 0 || parts.length === 0) parts.push(`${days}d`);
  return parts.join(" ");
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  headers: { key: string; label: string }[],
) {
  const headerRow = headers.map((h) => h.label).join(",");
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key];
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(","),
  );

  const csv = [headerRow, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

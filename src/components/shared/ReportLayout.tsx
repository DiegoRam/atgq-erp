import { PageHeader } from "./PageHeader";

interface ReportLayoutProps {
  title: string;
  description?: string;
  filters?: React.ReactNode;
  table: React.ReactNode;
  chart?: React.ReactNode;
  actions?: React.ReactNode;
}

export function ReportLayout({
  title,
  description,
  filters,
  table,
  chart,
  actions,
}: ReportLayoutProps) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} actions={actions} />
      {filters && <div className="flex items-center gap-2">{filters}</div>}
      {chart && (
        <div className="rounded-md border bg-white p-4">
          {chart}
        </div>
      )}
      {table}
    </div>
  );
}

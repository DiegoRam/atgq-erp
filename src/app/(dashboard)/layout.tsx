import { AppHeader } from "@/components/shared/AppHeader";
import { AppNavbar } from "@/components/shared/AppNavbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <AppNavbar />
      <main className="flex-1 bg-muted/30 p-4">{children}</main>
    </div>
  );
}

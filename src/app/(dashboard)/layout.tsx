import { AppHeader } from "@/components/shared/AppHeader";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { WorkspaceTabs } from "@/components/shared/WorkspaceTabs";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <AppNavbar />
      <WorkspaceTabs />
      <main className="flex-1 bg-muted/30 p-4">{children}</main>
      <Toaster richColors position="top-right" />
    </div>
  );
}

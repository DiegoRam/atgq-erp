import Link from "next/link";
import {
  Users,
  CreditCard,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/shared/StatsCard";
import { RecaudacionChart } from "@/components/shared/RecaudacionChart";
import { formatCurrency } from "@/lib/format";
import { getDashboardData } from "./actions";

export default async function HomePage() {
  const data = await getDashboardData();

  const kpis = [
    {
      title: "Socios Activos",
      value: data.sociosActivos,
      icon: Users,
      href: "/socios",
    },
    {
      title: "Cuotas Impagas (mes)",
      value: data.cuotasImpagas,
      icon: CreditCard,
      href: "/socios/morosos",
    },
    {
      title: "Recaudación (mes)",
      value: formatCurrency(data.recaudacionMes),
      icon: DollarSign,
      href: "/tesoreria/movimientos",
    },
    {
      title: "Ventas (mes)",
      value: formatCurrency(data.ventasMes),
      icon: ShoppingCart,
      href: "/ventas",
    },
    {
      title: "Stock Crítico",
      value: data.stockCritico,
      icon: AlertTriangle,
      href: "/stock",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen general — ATGQ ERP
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Link key={kpi.href} href={kpi.href}>
            <StatsCard
              title={kpi.title}
              value={kpi.value}
              icon={kpi.icon}
            />
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recaudación Neta — Últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecaudacionChart data={data.recaudacion6Meses} />
        </CardContent>
      </Card>
    </div>
  );
}

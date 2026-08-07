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

  // Cada tarjeta declara qué mide y enlaza a la pantalla que muestra ese mismo
  // número, para que el dashboard y los módulos sean comparables entre sí.
  const kpis = [
    {
      title: "Socios Activos",
      value: data.sociosActivos,
      hint: `de ${data.sociosTotal.toLocaleString("es-AR")} en el padrón`,
      icon: Users,
      href: "/socios?estado=activos",
    },
    {
      title: "Socios Morosos",
      value: data.sociosMorosos,
      hint: "con al menos una cuota impaga",
      icon: CreditCard,
      href: "/socios/morosos",
    },
    {
      title: "Resultado Neto (mes)",
      value: formatCurrency(data.resultadoNetoMes),
      hint: "ingresos − egresos de tesorería",
      icon: DollarSign,
      href: "/tesoreria/movimientos",
    },
    {
      title: "Ventas (mes)",
      value: formatCurrency(data.ventasMes),
      hint: "ventas no anuladas",
      icon: ShoppingCart,
      href: "/ventas",
    },
    {
      title: "Sin Stock",
      value: data.itemsSinStock,
      hint: "ítems en cero, por depósito",
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Link key={kpi.href} href={kpi.href}>
            <StatsCard
              title={kpi.title}
              value={kpi.value}
              hint={kpi.hint}
              icon={kpi.icon}
            />
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado Neto — Últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecaudacionChart data={data.recaudacion6Meses} />
        </CardContent>
      </Card>
    </div>
  );
}

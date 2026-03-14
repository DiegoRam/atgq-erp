import { PageHeader } from "@/components/shared/PageHeader";
import { PermisosMatrix } from "@/components/security/PermisosMatrix";
import { getRoleById, getRolePermisos } from "../actions";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function RoleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [role, permisos] = await Promise.all([
    getRoleById(params.id),
    getRolePermisos(params.id),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/security/roles">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Button>
        </Link>
        <PageHeader title={`Permisos: ${role.nombre}`} />
      </div>

      {role.descripcion && (
        <p className="text-sm text-muted-foreground">{role.descripcion}</p>
      )}

      <Badge variant="outline" className="text-sm">
        Configure los permisos por módulo para este rol
      </Badge>

      <PermisosMatrix rolId={role.id} initialPermisos={permisos} />
    </div>
  );
}

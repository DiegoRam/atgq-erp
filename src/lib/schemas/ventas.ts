import { z } from "zod";
import { todayISO } from "@/lib/format";

export const clienteSchema = z.object({
  apellido: z.string().min(1, "Apellido requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  dni: z.string().nullable().optional(),
  email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
  telefono: z.string().nullable().optional(),
});

export type ClienteSchemaType = z.infer<typeof clienteSchema>;

export const itemVentaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  precio: z.number().positive("El precio debe ser mayor a 0"),
  activo: z.boolean(),
  stock_item_id: z.string().uuid().nullable().optional(),
});

export type ItemVentaSchemaType = z.infer<typeof itemVentaSchema>;

export const nuevaVentaSchema = z
  .object({
    punto_venta_id: z.string().uuid("Seleccione un punto de venta"),
    cliente_id: z.string().uuid().nullable().optional(),
    socio_id: z.string().uuid().nullable().optional(),
    metodo_pago_id: z.string().uuid("Seleccione un método de pago"),
    // Datos del no socio: se cargan a mano en el mostrador y van juntos
    no_socio_nombre: z
      .string()
      .trim()
      .min(1, "Nombre requerido")
      .nullable()
      .optional(),
    // Se normalizan los puntos y recién ahí se valida: es el dato de
    // constancia ante ANMaC, así que un "no tengo" no sirve, y "30.123.456"
    // y "30123456" tienen que quedar guardados como el mismo string.
    no_socio_dni: z
      .string()
      .trim()
      .transform((v) => v.replace(/\./g, ""))
      .pipe(z.string().regex(/^\d{7,8}$/, "DNI inválido (7 u 8 dígitos)"))
      .nullable()
      .optional(),
    // z.iso.date() y no un regex: rechaza fechas inexistentes (9999-99-99)
    no_socio_credencial_vencimiento: z
      .iso
      .date("Fecha de vencimiento inválida")
      .nullable()
      .optional(),
    // El precio no viaja desde el browser: lo resuelve registrar_venta
    items: z
      .array(
        z.object({
          item_id: z.string().uuid(),
          cantidad: z.number().int().positive(),
        }),
      )
      .min(1, "Agregue al menos un ítem"),
  })
  .refine(
    (data) =>
      !!data.socio_id ||
      !!data.cliente_id ||
      (!!data.no_socio_nombre &&
        !!data.no_socio_dni &&
        !!data.no_socio_credencial_vencimiento),
    {
      message:
        "Debe seleccionar un socio o completar nombre, DNI y vencimiento de credencial del no socio",
      path: ["no_socio_nombre"],
    },
  )
  .refine(
    // Con socio o cliente la RPC descarta los datos de no socio: no hay
    // credencial que validar. Sin este guard el schema rechazaría un
    // payload que la base acepta.
    (data) =>
      !!data.socio_id ||
      !!data.cliente_id ||
      !data.no_socio_credencial_vencimiento ||
      data.no_socio_credencial_vencimiento >= todayISO(),
    {
      message: "La credencial de legítimo usuario está vencida",
      path: ["no_socio_credencial_vencimiento"],
    },
  );

export type NuevaVentaSchemaType = z.infer<typeof nuevaVentaSchema>;

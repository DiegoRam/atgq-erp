# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ATGQ-ERP is a new ERP system for the **Asociación de Tiro y Gimnasia de Quilmes** (ATGQ), a shooting and gymnastics club in Argentina. This project aims to replace the legacy system currently running at `atygq.sociosonline.ar`.

The repository is in its **initial planning phase** — no application code exists yet. The `docs/screenshots/` directory contains reference screenshots of the existing legacy system that the new ERP must replicate and improve upon.

## Legacy System Modules (from screenshots)

The existing system ("Sistema de Socios y Control Administrativo") has these main modules:

- **SOCIOS** — Member management (~8,400 members). Categories include Activo, Inactivo, Cadete, Vitalicio, Adherente, Honorario, Grupo Familiar, and "Ventanilla" variants. Tracks: Nro Socio, Apellido, Nombre, DNI, Categoría, Fecha Alta/Baja, Antigüedad, Pagas, Impagas, Cobranza method. Sub-features: Grupos Familiares, Socios Morosos, Cuotas, Padrón, reports by Categoría/Edad/Localidad, Categorías Sociales, Tipo de Cuotas, Cobranzas.
- **ACTIVIDADES** — Activity management: Administración de Actividades, Generar Cuota de Actividades, Actividades Extras.
- **TURNOS** — Shift/booking management.
- **VENTAS** — Sales: Nueva Venta, Ventas Realizadas, Clientes, Items de Ventas. Reports: Ventas Sumarizadas Mensual/Diaria, Venta de Item/periodo, Gráfico de Ventas, Gráfico de Items.
- **STOCK** — Inventory: Inventario (160 items across depósitos), Ingresos/Egresos, Movimientos de Stock, Depósitos. Items include shooting targets (blancos), ammunition (cartuchos), and supplies.
- **TESORERÍA** — Treasury/cash management: Cajas, Ingresar Movimiento, Movimientos de Fondos, Transferencias entre cajas. Reports: Sumarización de Conceptos, Concepto entre fechas, Gráfico de Movimientos/Salidas, Categorías movimientos.
- **Security** — User/role management.

## Directory Structure

- `docs/PRD.md` — Product Requirements Document (full spec for all modules)
- `docs/screenshots/` — Screenshots of the legacy system for reference
- `plan/PROMPT_PLAN.md` — Implementation prompts organized in 9 phases (33 tasks)
- `PROGRESS.md` — Task tracking board (status per phase/task)
- `CHANGELOG.md` — Change history (Keep-a-Changelog format)

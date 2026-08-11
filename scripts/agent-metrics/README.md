# agent-metrics

Etiquetado de PRs escritos por agentes y métricas de entrega (cycle time,
iteraciones de revisión, change failure rate, revert rate), con sync opcional a
un tablero de GitHub Projects v2.

Node sin dependencias (`.mjs`, `fetch` global). No entra al grafo de build de
Next ni al `tsconfig`: por eso son `.mjs` y no `.ts` — el `include` del
`tsconfig.json` es `**/*.ts`, así que un `scripts/*.ts` quedaría dentro de
`npx tsc --noEmit` bajo settings pensados para el bundler.

## Comandos

```bash
# Reporte de solo lectura contra la API real (no escribe nada)
GH_TOKEN=$(gh auth token) GH_REPO=DiegoRam/atgq-erp \
  node scripts/agent-metrics/report.mjs --since all --dry-run --no-project

# Etiquetar un PR
GH_TOKEN=$(gh auth token) GH_REPO=DiegoRam/atgq-erp \
  node scripts/agent-metrics/tag-pr.mjs --pr 12 --dry-run --verbose

# Backfill de etiquetas + reporte en vivo
node scripts/agent-metrics/report.mjs --since all --retag

# Crear los campos del tablero (una sola vez)
PROJECTS_TOKEN=<pat> node scripts/agent-metrics/ensure-project.mjs --project-number 1
```

Banderas útiles de `report.mjs`: `--since all|90d|2026-01-31`, `--base`,
`--no-project`, `--no-issue`, `--max-items`, `--settle-days`, `--verbose`.

`--dry-run` se aplica **dentro de `gh.mjs`**, no en cada caller: lee de la API
real y cortocircuita toda escritura. Es a propósito — si cada llamada tuviera
que acordarse de chequear la bandera, un olvido escribiría en producción
durante una prueba.

## Detección de autoría

Cuatro señales; cualquiera alcanza, y se registra cuál disparó:

| Señal     | Qué mira                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `trailer` | `Co-Authored-By: Claude` / `<…@anthropic.com>` / `Generated with Claude Code` en el **cuerpo** de algún commit              |
| `branch`  | prefijo de rama `claude/`, `agent/`, `ai/`, `codex/`, `bot/`                                                                |
| `marker`  | `<!-- agent-authored: true -->` o una casilla marcada con el sentinel `agent-authored`                                      |
| `actor`   | el PR lo abrió una cuenta/App de agente conocida (dependabot, renovate, coderabbit y vercel están excluidos explícitamente) |

Dos detalles que no son obvios:

- Los trailers viven en el **cuerpo** del commit. Un regex contra
  `messageHeadline` no matchea nunca.
- La detección por casilla **exige el sentinel literal** `agent-authored`. La
  plantilla de PR tiene más arriba una casilla `agent-browser`; un regex más
  laxo clasificaría como escrito-por-agente a todo PR que hubiera pasado por el
  navegador.

## Las métricas, y por qué están presentadas así

Con la muestra actual del repo (12 PRs auto-mergeados en segundos, cero
reverts, casi ninguna revisión antes del merge) las cuatro métricas pedidas dan
números correctos y engañosos. El reporte está construido para no mentir:

- `n` va pegado a cada estadística.
- Con `n < 5` no se imprimen percentiles: se imprimen los valores crudos.
- Percentiles por **nearest-rank**, no interpolados — con n=12 la interpolación
  inventa valores entre observaciones reales.
- Una tasa de 0 se reporta con su **cota superior de la regla de tres**
  (`0/12 → ≤ ~25%`), nunca como `0%`.
- El reporte encabeza con **lead time a producción** (el lead time de DORA de
  verdad, y el único reloj no degenerado acá). `open→merge` va rotulado como
  artefacto de auto-merge.
- Si casi nada se revisó antes de mergear, arriba de todo va un bloque que
  aclara que la sección de revisión mide **ausencia, no velocidad**.
- `metrics.json` incluye un objeto `dataQuality` para que quien consuma pueda
  decidir no mostrar los números.

### Change failure rate

Unión de tres señales, cada una con su evidencia adjunta:

1. **revert** — commit en `main` posterior al merge cuyo headline matchea
   `Revert "…"` o `revert(scope):`, y que referencia el merge commit, algún
   commit del PR, o `#<número>`.
2. **hotfix** — PR posterior (≤7 días) con título `fix(…)` cuyos archivos se
   solapan. **Es una sospecha, no un hecho.**
3. **deploy** — el deployment de producción del merge commit quedó en
   `failure`/`error`. Que _no haya_ deployment no cuenta como fallo: Vercel
   saltea los cambios solo-docs.

Dos límites conocidos de la señal 2, que el reporte imprime:

- Sin el filtro de docs tiene **100% de falsos positivos**: los 12 PRs del repo
  tocan `CHANGELOG.md`, así que cualquier par se "solapa". Verificado contra el
  repo real.
- Es **ciega a los bugs de migraciones**: `supabase/migrations/*` son archivos
  nuevos append-only, así que una migración que arregla a otra nunca comparte
  ruta con ella.

Los solapamientos con score `< 0.2` quedan como `suspected` y **no** entran al
CFR de portada.

## Projects v2: lo que la API puede y lo que no

**Los campos son estrictamente por ítem.** No hay campo de rollup, no hay campo
fórmula, no hay almacenamiento de agregados, y los gráficos de "Insights" del
tablero **no tienen API de GraphQL** — son solo UI. Un p50 o un CFR no tienen
dónde vivir nativamente en un tablero.

Las cuatro superficies que usa el script, de mayor a menor fidelidad:

1. **Campos por PR** — datos reales del tablero; el agrupado/filtrado nativo
   hace el resto.
2. **README del proyecto** (`updateProjectV2`) — mejor casa para los agregados;
   renderiza markdown completo arriba del tablero. Más un digest de una línea en
   `shortDescription` (tope ~150 caracteres).
3. **Issue de seguimiento** agregado al tablero como tarjeta — francamente un
   hack (un issue haciendo de fila de dashboard), pero es el único modo de que
   un agregado aparezca como tarjeta.
4. **Job summary de Actions** — siempre, sin PAT. Todo lo demás es una
   proyección de esto.

Restricciones de la API que cuestan una tarde si no se saben:

- `DATE` acepta `YYYY-MM-DD` y nada más; un ISO completo da error de schema.
- `SINGLE_SELECT` quiere el **id** de la opción, nunca la etiqueta.
- Para borrar un valor hay que llamar `clearProjectV2ItemFieldValue`; mandar
  `null` es error de schema.
- Los campos espejados (**Assignees, Labels, Milestone, Repository, Reviewers,
  Linked pull requests**) son de **solo lectura**: `agent-authored` aparece solo
  en el tablero cuando el tagger corre, y no hay forma de sincronizarlo a mano.
- `addProjectV2ItemById` es **idempotente**: si el PR ya está en el tablero
  devuelve el ítem existente. Eso es lo que hace que re-correr el reporte sea
  seguro.

El lookup de campos es **por nombre**. Renombrar un campo en la UI rompe el
sync: el script avisa con `::warning::` y sigue, no explota.

## Bootstrap manual

```bash
# 1. El token local no tiene el scope hoy
gh auth refresh -h github.com -s project,read:project

# 2. Tablero + variable de repo
gh project create --owner DiegoRam --title "Delivery Metrics"
gh project list --owner DiegoRam
gh variable set METRICS_PROJECT_NUMBER --repo DiegoRam/atgq-erp --body "<N>"

# 3. Campos (nombres exactos, incluidos los sufijos "(h)")
PROJECTS_TOKEN=<pat> node scripts/agent-metrics/ensure-project.mjs --project-number <N>

# 4. Secret con el PAT
gh secret set PROJECTS_TOKEN --repo DiegoRam/atgq-erp
```

**El PAT.** Fine-grained, recomendado: acceso solo a `atgq-erp`; permisos de
repositorio Contents `Read`, Issues `RW`, Pull requests `RW`, Deployments
`Read`, Commit statuses `Read`; y **Account permissions → Projects
`Read and write`**. Este último es el paso que todo el mundo se saltea: los
proyectos de un usuario viven en permisos de **cuenta**, no de repositorio.

Un PAT clásico con `repo` + `project` también sirve, pero `repo` da escritura
sobre **todos** los repos de la cuenta, y el secret vive en un repo **público**.

**Para que la detección dispare de verdad**, hace falta además:

- activar el trailer de co-autoría de Claude Code (`includeCoAuthoredBy: true`)
  para que los commits lleven `Co-Authored-By: Claude`;
- adoptar ramas `claude/<slug>` o `agent/<slug>` para el trabajo de agentes
  (hoy el convenio es `feat/*` / `fix/*`);
- dejar el bloque "Autoría" de la plantilla de PR.

Sin esto el sistema reporta, correctamente, 0% de PRs de agente. Mide una
práctica que todavía no deja rastro.

## Verificación

`next lint` no mira `scripts/`, y `tsc --noEmit` no ve `.mjs`. El único paso de
la compuerta de `CLAUDE.md` que **sí** aplica es Prettier: `.prettierignore` no
excluye `scripts/` ni `.github/`.

```bash
for f in scripts/agent-metrics/*.mjs; do node --check "$f" || echo "FAIL $f"; done
npx prettier --check .github scripts
node -e 'JSON.parse(require("fs").readFileSync(".github/labels.json"))'
```

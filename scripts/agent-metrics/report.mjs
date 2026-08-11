#!/usr/bin/env node
/**
 * Reporte de métricas de entrega sobre los PRs mergeados, con sync opcional
 * al tablero de Projects v2.
 *
 * Uso:
 *   node scripts/agent-metrics/report.mjs --since all --dry-run --no-project
 *   node scripts/agent-metrics/report.mjs --since 90d --retag
 *
 * Entorno:
 *   GH_TOKEN / GITHUB_TOKEN   lecturas + issue de seguimiento + retag
 *   PROJECTS_TOKEN            PAT con scope `project` (opcional; degrada)
 *   GH_REPO                   owner/name
 *   PROJECT_NUMBER            número del tablero (opcional)
 *
 * `--dry-run` lee de la API real y cortocircuita TODA escritura, en gh.mjs.
 * Es la afordancia que hace que este script se pueda iterar contra producción.
 */

import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { createClient } from './gh.mjs'
import { collect } from './collect.mjs'
import { computeMetrics } from './metrics.mjs'
import { detect, desiredLabels } from './detect.mjs'
import { loadTaxonomy, reconcilePrLabels } from './labels.mjs'
import { syncToProject } from './project.mjs'
import {
  renderReport,
  renderProjectReadme,
  renderShortDescription,
  renderTrackerIssue,
  TRACKER_MARKER,
} from './render.mjs'

const OUT_DIR = '.metrics'
const TRACKER_TITLE = '[metrics] Métricas de entrega de PRs de agentes'

/**
 * Number() sobre un flag mal tipeado da NaN, y los NaN fallan abiertos en
 * direcciones opuestas: `slice(0, NaN)` es `[]` (el sync no escribe nada y
 * reporta éxito) mientras que `Math.max(NaN, MIN)` es NaN, con lo cual
 * `now - mergedAt < NaN` es false y TODO PR —incluso uno mergeado hace 30
 * segundos— entra al denominador del CFR como si ya hubiera asentado.
 */
function num(value, fallback) {
  const n = Number(value)
  if (Number.isFinite(n)) return n
  if (value !== undefined && value !== '') {
    console.error(`::warning::valor numérico inválido ${JSON.stringify(value)}; uso ${fallback}`)
  }
  return fallback
}

function parseArgs(argv) {
  const env = process.env
  const args = {
    since: env.SINCE || '90d',
    base: env.BASE_BRANCH || 'main',
    dryRun: env.DRY_RUN === 'true',
    retag: env.RETAG === 'true',
    verbose: false,
    noProject: false,
    noIssue: false,
    projectNumber: env.PROJECT_NUMBER || '',
    maxItems: 200,
    settleDays: num(env.SETTLE_DAYS, 3),
    hotfixWindowDays: num(env.HOTFIX_WINDOW_DAYS, 7),
    // Apagado por defecto: la heurística está sin calibrar (ver metrics.mjs).
    countHotfix: env.COUNT_HOTFIX === 'true',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--since') args.since = argv[++i]
    else if (a === '--base') args.base = argv[++i]
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--retag') args.retag = true
    else if (a === '--verbose') args.verbose = true
    else if (a === '--no-project') args.noProject = true
    else if (a === '--no-issue') args.noIssue = true
    else if (a === '--project-number') args.projectNumber = argv[++i]
    else if (a === '--max-items') args.maxItems = num(argv[++i], args.maxItems)
    else if (a === '--settle-days') args.settleDays = num(argv[++i], args.settleDays)
    else if (a === '--count-hotfix') args.countHotfix = true
  }
  return args
}

async function writeSummary(markdown) {
  const path = process.env.GITHUB_STEP_SUMMARY
  if (!path) return
  await appendFile(path, `${markdown}\n`)
}

/**
 * Backfill de etiquetas sobre PRs ya mergeados. Reutiliza el mismo predicado
 * que el tagger para que la cohorte no dependa de por dónde entró el PR.
 */
async function retagAll(gh, prs, { log = console.error } = {}) {
  const taxonomy = await loadTaxonomy()
  let changed = 0
  for (const pr of prs) {
    const result = detect(pr)
    const desired = desiredLabels(result)
    const current = pr.labels || []
    const r = await reconcilePrLabels(gh, pr.number, desired, current, { taxonomy, log: () => {} })
    if (r.changed) {
      changed++
      log(`[retag] #${pr.number}: +${r.toAdd.join(',') || '—'} -${r.toRemove.join(',') || '—'}`)
    }
  }
  log(`[retag] ${changed} de ${prs.length} PRs modificados`)
  return changed
}

/** Upsert del issue de seguimiento, localizado por marcador y no por título. */
async function upsertTrackerIssue(gh, body, { log = console.error } = {}) {
  // Sin `labels=` vacío: ese parámetro filtra por etiqueta, así que en cuanto
  // el issue tuviera una dejaría de encontrarse y cada corrida crearía uno nuevo.
  // `state=all` porque un issue cerrado a mano sigue siendo el mismo tracker.
  //
  // `sort=created&direction=asc` importa: este endpoint devuelve también los
  // PRs, y con el orden por defecto (más nuevo primero) el tracker se hunde
  // fuera de la ventana a medida que el repo acumula PRs, y cada corrida
  // semanal crearía un tracker nuevo. Ordenado ascendente queda siempre en la
  // primera página, porque se creó antes que casi todo lo demás.
  const issues = await gh.restPaginate(
    `/repos/${gh.owner}/${gh.repo}/issues?state=all&per_page=100&sort=created&direction=asc`,
    { max: 500 },
  )
  // El marcador manda; el título es respaldo por si alguien reescribe el cuerpo.
  const existing =
    issues.find((i) => !i.pull_request && String(i.body || '').includes(TRACKER_MARKER)) ??
    issues.find((i) => !i.pull_request && i.title === TRACKER_TITLE)

  if (existing) {
    await gh.rest('PATCH', `/repos/${gh.owner}/${gh.repo}/issues/${existing.number}`, {
      body: { body, title: TRACKER_TITLE },
      label: `actualizar issue de seguimiento #${existing.number}`,
    })
    log(`[report] issue de seguimiento actualizado: #${existing.number}`)
    return existing.number
  }

  const created = await gh.rest('POST', `/repos/${gh.owner}/${gh.repo}/issues`, {
    body: { title: TRACKER_TITLE, body },
    label: 'crear issue de seguimiento',
  })
  if (created?.dryRun) return null
  log(`[report] issue de seguimiento creado: #${created.number}`)
  return created.number
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const log = console.error

  const gh = createClient({
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    repo: process.env.GH_REPO,
    dryRun: args.dryRun,
    verbose: args.verbose,
  })

  log(`[report] repo ${gh.owner}/${gh.repo} · since=${args.since} · dryRun=${args.dryRun}`)

  const collected = await collect(gh, { since: args.since, base: args.base, log })

  if (args.retag) {
    await retagAll(gh, collected.prs, { log })
    // Releemos las etiquetas del objeto en memoria para que el reporte muestre
    // el estado post-backfill y no el de antes.
    for (const pr of collected.prs) {
      const d = detect(pr)
      pr.labels = desiredLabels(d)
    }
  }

  const metrics = computeMetrics(collected, {
    settleDays: args.settleDays,
    hotfixWindowDays: args.hotfixWindowDays,
    countHotfix: args.countHotfix,
  })

  const report = renderReport(metrics)
  console.log(report)
  await writeSummary(report)

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(`${OUT_DIR}/report.md`, report)
  await writeFile(`${OUT_DIR}/metrics.json`, JSON.stringify(metrics, null, 2))
  log(`[report] escrito ${OUT_DIR}/report.md y ${OUT_DIR}/metrics.json`)

  if (!args.noIssue) {
    try {
      await upsertTrackerIssue(gh, renderTrackerIssue(metrics), { log })
    } catch (err) {
      log(`::warning::no pude actualizar el issue de seguimiento: ${err.message}`)
    }
  }

  let projectResult = { skipped: 'deshabilitado' }
  if (!args.noProject) {
    projectResult = await syncToProject(gh, {
      owner: gh.owner,
      number: args.projectNumber,
      token: process.env.PROJECTS_TOKEN,
      records: metrics.records,
      readme: renderProjectReadme(metrics),
      shortDescription: renderShortDescription(metrics),
      maxItems: args.maxItems,
      log,
    })
  }
  log(`[report] projects v2: ${JSON.stringify(projectResult)}`)

  if (
    projectResult.skipped === 'insufficient_scopes' ||
    projectResult.skipped === 'sin PROJECTS_TOKEN'
  ) {
    await writeSummary(
      `\n> [!NOTE]\n> Sync con Projects v2 omitido (\`${projectResult.skipped}\`). Los agregados están arriba en este resumen.`,
    )
  }

  log(`[report] stats: ${JSON.stringify(gh.stats)} · rateLimit=${JSON.stringify(gh.rateLimit)}`)
}

main().catch((err) => {
  console.error(`::error::report falló: ${err.message}`)
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2))
  process.exit(1)
})

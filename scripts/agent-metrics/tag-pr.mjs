#!/usr/bin/env node
/**
 * Etiqueta un PR según su autoría (agente o persona).
 *
 * Uso:
 *   node scripts/agent-metrics/tag-pr.mjs --pr 12
 *   node scripts/agent-metrics/tag-pr.mjs --pr 12 --dry-run --verbose
 *
 * Entorno: GH_TOKEN (o GITHUB_TOKEN), GH_REPO=owner/name
 *
 * El script re-consulta todo por la API en vez de recibir el cuerpo o la rama
 * del PR por argumento. No es paranoia decorativa: son strings que controla
 * quien abre el PR, y hacerlos pasar por la línea de comandos de un job con
 * token de escritura es exactamente la forma canónica de inyección en Actions.
 * Acá lo único que cruza el shell es el NÚMERO de PR, que lo pone GitHub.
 */

import { appendFile } from 'node:fs/promises'
import { createClient } from './gh.mjs'
import { detect, desiredLabels } from './detect.mjs'
import { loadTaxonomy, reconcilePrLabels } from './labels.mjs'
import { renderTagSummary, PROVENANCE_MARKER } from './render.mjs'

function parseArgs(argv) {
  const args = { dryRun: false, verbose: false, comment: false, pr: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--pr') args.pr = Number(argv[++i])
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--verbose') args.verbose = true
    else if (a === '--comment') args.comment = true
    else if (a.startsWith('--pr=')) args.pr = Number(a.slice(5))
  }
  return args
}

async function writeSummary(markdown) {
  const path = process.env.GITHUB_STEP_SUMMARY
  if (!path) return
  await appendFile(path, `${markdown}\n`)
}

/** Comentario pegajoso: se busca por marcador y se edita. Nunca un segundo comentario. */
async function upsertProvenanceComment(gh, prNumber, body) {
  const comments = await gh.restPaginate(
    `/repos/${gh.owner}/${gh.repo}/issues/${prNumber}/comments?per_page=100`,
  )
  const mine = comments.find((c) => String(c.body || '').includes(PROVENANCE_MARKER))
  const payload = { body: `${PROVENANCE_MARKER}\n${body}` }
  if (mine) {
    await gh.rest('PATCH', `/repos/${gh.owner}/${gh.repo}/issues/comments/${mine.id}`, {
      body: payload,
      label: 'editar comentario de provenance',
    })
  } else {
    await gh.rest('POST', `/repos/${gh.owner}/${gh.repo}/issues/${prNumber}/comments`, {
      body: payload,
      label: 'crear comentario de provenance',
    })
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const prNumber = args.pr ?? Number(process.env.PR_NUMBER)
  if (!Number.isFinite(prNumber)) {
    console.error('Falta --pr <numero> (o PR_NUMBER en el entorno)')
    process.exit(2)
  }

  const gh = createClient({
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    repo: process.env.GH_REPO,
    dryRun: args.dryRun,
    verbose: args.verbose,
  })

  const pr = await gh.rest('GET', `/repos/${gh.owner}/${gh.repo}/pulls/${prNumber}`)
  const commits = await gh.restPaginate(
    `/repos/${gh.owner}/${gh.repo}/pulls/${prNumber}/commits?per_page=100`,
    { max: 250 },
  )
  if (commits.length >= 250) {
    console.error(
      `[tag] #${prNumber} tiene 250+ commits; la detección por trailer mira los primeros 250`,
    )
  }

  const result = detect({
    headRefName: pr.head?.ref,
    body: pr.body,
    author: { login: pr.user?.login, type: pr.user?.type },
    // El merge commit NO está en esta lista, y está bien: queremos la autoría
    // del trabajo, no la de quien apretó "Merge".
    commits: commits.map((c) => ({ oid: c.sha, message: c.commit?.message })),
  })

  const desired = desiredLabels(result)
  const current = (pr.labels || []).map((l) => l.name)
  const taxonomy = await loadTaxonomy()

  const reconcile = await reconcilePrLabels(gh, prNumber, desired, current, { taxonomy })

  const summary = renderTagSummary({
    prNumber,
    result,
    desired,
    reconcile,
    dryRun: args.dryRun,
  })
  console.log(summary)
  await writeSummary(summary)

  if (args.comment) await upsertProvenanceComment(gh, prNumber, summary)

  if (args.verbose) {
    console.error(`[tag] stats: ${JSON.stringify(gh.stats)}`)
  }
}

main().catch((err) => {
  console.error(`::error::tag-pr falló: ${err.message}`)
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2))
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Bootstrap e inspección del tablero de Projects v2.
 *
 *   node scripts/agent-metrics/ensure-project.mjs --project-number 1 --describe
 *   PROJECTS_TOKEN=<pat> node scripts/agent-metrics/ensure-project.mjs --project-number 1
 *
 * `--describe` es de solo lectura: imprime el id del proyecto y la tabla de
 * campos con sus ids y los ids de las opciones de cada single-select. Es lo
 * primero que hay que correr cuando el sync "no escribe nada": casi siempre es
 * un nombre de campo que no coincide.
 */

import { createClient, isInsufficientScopes } from './gh.mjs'
import { discoverProject, ensureFields, FIELD_SPECS } from './project.mjs'

function parseArgs(argv) {
  const args = {
    number: process.env.PROJECT_NUMBER || '',
    owner: '',
    describe: false,
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--project-number') args.number = argv[++i]
    else if (a === '--owner') args.owner = argv[++i]
    else if (a === '--describe') args.describe = true
    else if (a === '--dry-run') args.dryRun = true
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.number) {
    console.error('Falta --project-number <N> (o PROJECT_NUMBER en el entorno)')
    process.exit(2)
  }

  const token = process.env.PROJECTS_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  const gh = createClient({ token, repo: process.env.GH_REPO, dryRun: args.dryRun, verbose: true })
  const owner = args.owner || gh.owner

  let project
  try {
    project = await discoverProject(gh, { owner, number: args.number, token })
  } catch (err) {
    if (isInsufficientScopes(err)) {
      console.error(
        '::error::el token no tiene el scope `project`.\n' +
          'Local:  gh auth refresh -h github.com -s project,read:project\n' +
          'PAT:    fine-grained con Account permissions → Projects: Read and write',
      )
      process.exit(1)
    }
    throw err
  }

  if (!project) {
    console.error(`::error::no encontré el proyecto #${args.number} de ${owner}`)
    process.exit(1)
  }

  console.log(`Proyecto: ${project.title} (#${project.number})`)
  console.log(`  id:  ${project.id}`)
  console.log(`  url: ${project.url}`)
  console.log('')
  console.log('Campos:')
  for (const [name, f] of project.fieldsByName) {
    console.log(`  ${name.padEnd(24)} ${String(f.dataType).padEnd(16)} ${f.id}`)
    for (const o of f.options ?? []) console.log(`      · ${o.name.padEnd(18)} ${o.id}`)
  }

  const missing = FIELD_SPECS.filter((s) => !project.fieldsByName.has(s.name))
  if (!missing.length) {
    console.log('\nTodos los campos esperados existen.')
    return
  }

  console.log(`\nFaltan ${missing.length}: ${missing.map((m) => m.name).join(', ')}`)
  if (args.describe) {
    console.log('(--describe es de solo lectura; corré sin esa bandera para crearlos)')
    return
  }

  const created = await ensureFields(gh, { project, token })
  console.log(`Campos creados: ${created.join(', ') || 'ninguno'}`)
}

main().catch((err) => {
  console.error(`::error::ensure-project falló: ${err.message}`)
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2))
  process.exit(1)
})

/**
 * Integración con Projects v2.
 *
 * LA LIMITACIÓN QUE HAY QUE SABER ANTES DE LEER EL CÓDIGO:
 *
 * Los campos de Projects v2 son estrictamente POR ÍTEM. No hay campo de
 * rollup, no hay campo fórmula, no hay almacenamiento de agregados, y los
 * gráficos de "Insights" del tablero no tienen API de GraphQL — son solo UI.
 * O sea: un p50 de cycle time o un change failure rate NO tienen dónde vivir
 * nativamente en un tablero.
 *
 * Lo que sí se puede, en orden de fidelidad:
 *   1. campos por PR            -> datos reales del tablero (esto es lo que rinde)
 *   2. README del proyecto      -> mejor casa para los agregados (markdown completo)
 *   3. issue de seguimiento     -> el único modo de que un agregado sea una TARJETA
 *   4. job summary de Actions   -> siempre, sin PAT; todo lo demás es proyección
 *
 * Restricciones de la API que cuestan una tarde si no se saben:
 *   - DATE acepta 'YYYY-MM-DD' y NADA más; un ISO completo da error de schema
 *   - SINGLE_SELECT quiere el ID de la opción, nunca la etiqueta
 *   - para borrar un valor hay que llamar clearProjectV2ItemFieldValue;
 *     mandar null es error de schema
 *   - los campos espejados (Assignees, Labels, Milestone, Repository,
 *     Reviewers, Linked pull requests) son de SOLO LECTURA: `agent-authored`
 *     aparece solo en el tablero cuando el tagger corre, y no hay forma de
 *     sincronizarlo a mano aunque uno quiera
 */

import { isInsufficientScopes } from './gh.mjs'

const PROJECT_QUERY = `
query($owner: String!, $number: Int!) {
  rateLimit { cost remaining resetAt }
  user(login: $owner) {
    projectV2(number: $number) { ...ProjectDetail }
  }
}
fragment ProjectDetail on ProjectV2 {
  id title url number shortDescription
  fields(first: 50) {
    nodes {
      ... on ProjectV2FieldCommon { id name dataType }
      ... on ProjectV2SingleSelectField { id name dataType options { id name } }
      ... on ProjectV2IterationField { id name dataType }
    }
  }
}`

const PROJECT_QUERY_ORG = PROJECT_QUERY.replace(
  'user(login: $owner)',
  'organization(login: $owner)',
)

/**
 * Ítems ya presentes con sus valores actuales, para no reescribir lo que no
 * cambió. Sin esto el sync es idempotente en VALOR pero no en ESCRITURAS: cada
 * corrida emitiría addItem + hasta 10 mutaciones por PR aunque nada se moviera,
 * que al piso de 150ms son ~5 minutos de puro sleep en el tope de 200 ítems.
 * El módulo de etiquetas ya fija la vara: si no hay nada que cambiar, no se
 * escribe nada.
 */
const PROJECT_ITEMS = `
query($project: ID!, $after: String) {
  rateLimit { cost remaining resetAt }
  node(id: $project) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content { ... on PullRequest { number } ... on Issue { number } }
          fieldValues(first: 30) {
            nodes {
              __typename
              ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } }
              ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
              ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
              ... on ProjectV2ItemFieldSingleSelectValue { optionId field { ... on ProjectV2FieldCommon { name } } }
            }
          }
        }
      }
    }
  }
}`

const ADD_ITEM = `
mutation($project: ID!, $content: ID!) {
  addProjectV2ItemById(input: { projectId: $project, contentId: $content }) {
    item { id }
  }
}`

const UPDATE_FIELD = `
mutation($project: ID!, $item: ID!, $field: ID!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(
    input: { projectId: $project, itemId: $item, fieldId: $field, value: $value }
  ) { projectV2Item { id } }
}`

const UPDATE_PROJECT = `
mutation($project: ID!, $readme: String, $shortDescription: String) {
  updateProjectV2(
    input: { projectId: $project, readme: $readme, shortDescription: $shortDescription }
  ) { projectV2 { id } }
}`

const CREATE_FIELD = `
mutation($project: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!,
         $options: [ProjectV2SingleSelectFieldOptionInput!]) {
  createProjectV2Field(
    input: { projectId: $project, name: $name, dataType: $dataType, singleSelectOptions: $options }
  ) { projectV2Field { ... on ProjectV2FieldCommon { id name dataType } } }
}`

/**
 * Definición de los campos del tablero. El lookup es POR NOMBRE, así que
 * renombrar un campo a mano en la UI rompe el sync (avisa, no explota).
 */
export const FIELD_SPECS = [
  { name: 'Authorship', dataType: 'SINGLE_SELECT', options: ['Agent', 'Human', 'Unknown'] },
  { name: 'Signals', dataType: 'TEXT' },
  { name: 'Merged At', dataType: 'DATE' },
  { name: 'Coding Time (h)', dataType: 'NUMBER' },
  { name: 'Lead Time to Prod (h)', dataType: 'NUMBER' },
  { name: 'Open→Merge (min)', dataType: 'NUMBER' },
  { name: 'Review Iterations', dataType: 'NUMBER' },
  { name: 'Reviewed Pre-Merge', dataType: 'SINGLE_SELECT', options: ['Yes', 'No'] },
  {
    name: 'Change Failure',
    dataType: 'SINGLE_SELECT',
    options: ['None', 'Revert', 'Hotfix', 'Deploy', 'Multiple'],
  },
  { name: 'Failure Evidence', dataType: 'TEXT' },
]

const SELECT_COLORS = ['GRAY', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'RED', 'PURPLE', 'PINK']

/** Busca el proyecto como usuario y, si no, como organización (sobrevive una mudanza a org). */
export async function discoverProject(gh, { owner, number, token, log = console.error }) {
  const vars = { owner, number: Number(number) }
  const opts = { overrideToken: token, label: `proyecto #${number}` }

  // Los fallos de credencial se re-lanzan; sólo se traga el "no está acá",
  // que es lo único que justifica probar la otra forma. Si un 401 se
  // convirtiera en `null`, un PAT vencido —y los PAT vencen— se reportaría
  // como "no encontré el proyecto" y se saldría a buscar un tablero renombrado
  // en vez de renovar el token.
  const fatal = (err) => isInsufficientScopes(err) || err.status === 401 || err.status === 403

  let project = null
  try {
    const data = await gh.graphql(PROJECT_QUERY, vars, opts)
    project = data?.user?.projectV2 ?? null
  } catch (err) {
    if (fatal(err)) throw err
    log(`[project] búsqueda como usuario falló: ${err.message}`)
  }

  if (!project) {
    try {
      const data = await gh.graphql(PROJECT_QUERY_ORG, vars, opts)
      project = data?.organization?.projectV2 ?? null
    } catch (err) {
      if (fatal(err)) throw err
      log(`[project] búsqueda como organización falló: ${err.message}`)
    }
  }

  if (!project) return null

  const fieldsByName = new Map()
  for (const f of project.fields?.nodes ?? []) {
    if (f?.name) fieldsByName.set(f.name, f)
  }
  return { ...project, fieldsByName }
}

/**
 * Convierte un valor plano a la forma que exige el dataType del campo.
 * Devuelve null cuando no hay nada que escribir (el caller omite la mutación;
 * mandar null a la API sería un error de schema, no un "borrar").
 */
export function toFieldValue(field, raw, { log = console.error } = {}) {
  if (raw === null || raw === undefined || raw === '') return null

  switch (field.dataType) {
    case 'NUMBER': {
      const n = Number(raw)
      return Number.isFinite(n) ? { number: n } : null
    }
    case 'TEXT':
      return { text: String(raw).slice(0, 1024) }
    case 'DATE': {
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return null
      // Sólo la fecha: un timestamp ISO completo hace fallar la mutación.
      return { date: d.toISOString().slice(0, 10) }
    }
    case 'SINGLE_SELECT': {
      const wanted = String(raw).toLowerCase()
      const opt = (field.options || []).find((o) => o.name.toLowerCase() === wanted)
      if (!opt) {
        log(`[project] el campo "${field.name}" no tiene la opción "${raw}"; se omite`)
        return null
      }
      return { singleSelectOptionId: opt.id }
    }
    default:
      log(`[project] dataType ${field.dataType} no soportado en "${field.name}"; se omite`)
      return null
  }
}

/** Agrega el contenido al tablero. Idempotente: si ya está, devuelve su ítem. */
export async function addItem(gh, { projectId, contentId, token }) {
  const data = await gh.graphql(
    ADD_ITEM,
    { project: projectId, content: contentId },
    { overrideToken: token, label: 'addProjectV2ItemById' },
  )
  if (data?.dryRun) return null
  return data?.addProjectV2ItemById?.item?.id ?? null
}

/** Trae los ítems del tablero indexados por número de contenido. */
export async function fetchProjectItems(gh, { projectId, token, log = console.error }) {
  const byNumber = new Map()
  try {
    const nodes = await gh.graphqlPaginate(
      PROJECT_ITEMS,
      { project: projectId },
      { path: 'node.items', max: 2000, label: 'ítems del tablero', overrideToken: token },
    )
    for (const item of nodes) {
      const number = item?.content?.number
      if (number == null) continue
      const values = new Map()
      for (const fv of item.fieldValues?.nodes ?? []) {
        const name = fv?.field?.name
        if (!name) continue
        // Se normaliza a la misma forma que produce toFieldValue, para poder
        // comparar por igualdad estructural.
        if (fv.__typename === 'ProjectV2ItemFieldNumberValue')
          values.set(name, { number: fv.number })
        else if (fv.__typename === 'ProjectV2ItemFieldTextValue')
          values.set(name, { text: fv.text })
        else if (fv.__typename === 'ProjectV2ItemFieldDateValue')
          values.set(name, { date: fv.date })
        else if (fv.__typename === 'ProjectV2ItemFieldSingleSelectValue')
          values.set(name, { singleSelectOptionId: fv.optionId })
      }
      byNumber.set(number, { id: item.id, values })
    }
  } catch (err) {
    // No poder leer el estado previo degrada a "reescribir todo", que es
    // correcto aunque más lento. No es motivo para abortar el sync.
    log(`[project] no pude leer los ítems existentes (${err.message}); reescribo todo`)
  }
  return byNumber
}

const sameValue = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b)

/** Escribe los campos de un ítem. Omite los que no existen y los que ya están. */
export async function setItemFields(
  gh,
  { projectId, itemId, project, values, existing, token, log = console.error },
) {
  let written = 0
  let skipped = 0
  for (const [name, raw] of Object.entries(values)) {
    const field = project.fieldsByName.get(name)
    if (!field) {
      log(`::warning::el campo "${name}" no existe en el proyecto #${project.number}; se omite`)
      continue
    }
    const value = toFieldValue(field, raw, { log })
    if (!value) continue
    if (sameValue(existing?.get(name), value)) {
      skipped++
      continue
    }
    await gh.graphql(
      UPDATE_FIELD,
      { project: projectId, item: itemId, field: field.id, value },
      { overrideToken: token, label: `set ${name}` },
    )
    written++
  }
  return { written, skipped }
}

/**
 * Los agregados van al README del proyecto (markdown completo arriba del
 * tablero) y un digest de una línea a la descripción corta.
 */
export async function updateProjectReadme(
  gh,
  { projectId, readme, shortDescription, token, log = console.error },
) {
  const vars = { project: projectId, readme: readme ?? null }
  // shortDescription tiene tope de longitud; recortamos antes de que la API se queje.
  if (shortDescription) vars.shortDescription = shortDescription.slice(0, 150)
  try {
    await gh.graphql(UPDATE_PROJECT, vars, { overrideToken: token, label: 'updateProjectV2' })
    return true
  } catch (err) {
    log(`::warning::no pude actualizar el README del proyecto: ${err.message}`)
    return false
  }
}

/** Bootstrap: crea los campos que falten según FIELD_SPECS. */
export async function ensureFields(gh, { project, token, log = console.error }) {
  const created = []
  for (const spec of FIELD_SPECS) {
    if (project.fieldsByName.has(spec.name)) continue
    const options = spec.options?.map((name, i) => ({
      name,
      color: SELECT_COLORS[i % SELECT_COLORS.length],
      description: '',
    }))
    try {
      await gh.graphql(
        CREATE_FIELD,
        {
          project: project.id,
          name: spec.name,
          dataType: spec.dataType,
          options: options ?? null,
        },
        { overrideToken: token, label: `crear campo ${spec.name}` },
      )
      created.push(spec.name)
      log(`[project] campo creado: ${spec.name} (${spec.dataType})`)
    } catch (err) {
      log(`::warning::no pude crear el campo "${spec.name}": ${err.message}`)
    }
  }
  return created
}

/** Valores de tablero para un registro de PR. */
export function fieldValuesForRecord(record) {
  const evidence = []
  if (record.failure.revert) evidence.push(`revert ${record.failure.revert.oid}`)
  if (record.failure.hotfix) {
    const h = record.failure.hotfix
    evidence.push(
      `${h.weak ? 'sospecha ' : ''}hotfix #${h.number} (${h.overlapScore}): ${h.overlap.slice(0, 3).join(', ')}`,
    )
  }
  if (record.failure.deployFailure) evidence.push(`deploy ${record.failure.deployFailure.state}`)

  return {
    Authorship: record.authorship,
    Signals: record.signals.join('+') || (record.inferred ? 'inferido: ninguna' : ''),
    'Merged At': record.mergedAt,
    'Coding Time (h)': record.codingTimeH,
    'Lead Time to Prod (h)': record.leadTimeToProdH,
    'Open→Merge (min)': record.openToMergeMin,
    'Review Iterations': record.review.iterations,
    'Reviewed Pre-Merge': record.review.reviewedBeforeMerge ? 'Yes' : 'No',
    'Change Failure': record.failure.kind,
    'Failure Evidence': evidence.join(' · '),
  }
}

/**
 * Sincroniza los PRs al tablero. Devuelve un resumen; nunca tira si el token
 * no alcanza: en ese caso el reporte sigue por el job summary.
 */
export async function syncToProject(
  gh,
  { owner, number, token, records, readme, shortDescription, maxItems = 200, log = console.error },
) {
  if (!number) return { skipped: 'sin numero de proyecto' }
  if (!token) return { skipped: 'sin PROJECTS_TOKEN' }

  let project
  try {
    project = await discoverProject(gh, { owner, number, token, log })
  } catch (err) {
    if (isInsufficientScopes(err)) {
      log('::notice::el token no tiene el scope `project`; se omite el sync con el tablero')
      return { skipped: 'insufficient_scopes' }
    }
    if (err.status === 401 || err.status === 403) {
      log(
        `::warning::PROJECTS_TOKEN rechazado (${err.status}). Lo más probable es que el PAT haya vencido: renovalo y volvé a correr \`gh secret set PROJECTS_TOKEN\`.`,
      )
      return { skipped: 'unauthorized' }
    }
    throw err
  }

  if (!project) {
    log(`::warning::no encontré el proyecto #${number} de ${owner}`)
    return { skipped: 'not_found' }
  }

  const missing = FIELD_SPECS.filter((s) => !project.fieldsByName.has(s.name)).map((s) => s.name)
  if (missing.length) {
    log(`::warning::faltan campos en el tablero: ${missing.join(', ')} (corré --ensure-fields)`)
  }

  const existingItems = await fetchProjectItems(gh, { projectId: project.id, token, log })

  let items = 0
  let fields = 0
  let skippedFields = 0
  let unchangedItems = 0
  for (const record of records.slice(0, maxItems)) {
    if (!record.nodeId) continue

    const known = existingItems.get(record.number)
    // `addProjectV2ItemById` es idempotente, pero sigue siendo una mutación.
    // Si el ítem ya está en el tablero nos la salteamos del todo.
    const itemId =
      known?.id ?? (await addItem(gh, { projectId: project.id, contentId: record.nodeId, token }))
    if (!itemId) continue // dry-run
    items++

    const res = await setItemFields(gh, {
      projectId: project.id,
      itemId,
      project,
      values: fieldValuesForRecord(record),
      existing: known?.values,
      token,
      log,
    })
    fields += res.written
    skippedFields += res.skipped
    if (res.written === 0) unchangedItems++
  }

  if (fields === 0 && items > 0) {
    log(`::notice::tablero ya sincronizado; ${skippedFields} campos sin cambios, cero escrituras`)
  }

  if (records.length > maxItems) {
    log(`::notice::sincronicé ${maxItems} de ${records.length} PRs (tope --max-items)`)
  }

  const readmeOk = readme
    ? await updateProjectReadme(gh, {
        projectId: project.id,
        readme,
        shortDescription,
        token,
        log,
      })
    : false

  return {
    project: { id: project.id, number: project.number, title: project.title, url: project.url },
    items,
    fields,
    skippedFields,
    unchangedItems,
    missingFields: missing,
    readmeUpdated: readmeOk,
    truncated: records.length > maxItems ? records.length - maxItems : 0,
  }
}

/**
 * Creación y reconciliación de etiquetas.
 *
 * Dos garantías que importan:
 *
 * 1. Las etiquetas se CREAN antes de usarse. Ninguna de las nuestras existe en
 *    el repo todavía, y adjuntar una etiqueta desconocida por el endpoint de
 *    issues la crea con un color arbitrario. Queremos los colores del taxonomy.
 *
 * 2. La reconciliación es idempotente y acotada a un namespace. Si no hay nada
 *    que cambiar no se emite NINGUNA escritura — es lo que hace que el tagger
 *    pueda correr en cada `synchronize` sin ensuciar el timeline del PR.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { isManagedLabel } from './detect.mjs'
import { isNotFound } from './gh.mjs'

const LABELS_PATH = fileURLToPath(new URL('../../.github/labels.json', import.meta.url))

let cachedTaxonomy = null

export async function loadTaxonomy(path = LABELS_PATH) {
  if (cachedTaxonomy) return cachedTaxonomy
  const raw = await readFile(path, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`${path} debe ser un array de etiquetas`)
  cachedTaxonomy = new Map(parsed.map((l) => [l.name, l]))
  return cachedTaxonomy
}

/**
 * Garantiza que la etiqueta exista con el color/descripción del taxonomy.
 * Tolera la carrera de dos runs concurrentes (422 already_exists).
 */
export async function ensureLabel(gh, name, { taxonomy, log = console.error } = {}) {
  const spec = taxonomy?.get(name)
  if (!spec) {
    log(`[labels] "${name}" no está en .github/labels.json; se omite`)
    return false
  }

  const encoded = encodeURIComponent(name)
  let existing = null
  try {
    existing = await gh.rest('GET', `/repos/${gh.owner}/${gh.repo}/labels/${encoded}`)
  } catch (err) {
    if (!isNotFound(err)) throw err
  }

  if (!existing) {
    try {
      await gh.rest('POST', `/repos/${gh.owner}/${gh.repo}/labels`, {
        body: { name: spec.name, color: spec.color, description: spec.description },
        label: `crear etiqueta ${name}`,
      })
      return true
    } catch (err) {
      // Otro run la creó entre nuestro GET y nuestro POST. No es un error.
      if (err.status !== 422) throw err
      log(`[labels] "${name}" ya existía (carrera); sigo`)
      return false
    }
  }

  const drifted =
    existing.color?.toLowerCase() !== spec.color.toLowerCase() ||
    (existing.description || '') !== (spec.description || '')
  if (drifted) {
    await gh.rest('PATCH', `/repos/${gh.owner}/${gh.repo}/labels/${encoded}`, {
      body: { new_name: spec.name, color: spec.color, description: spec.description },
      label: `actualizar etiqueta ${name}`,
    })
  }
  return drifted
}

/**
 * Lleva las etiquetas del PR al estado deseado, tocando SOLO el namespace
 * gestionado. Devuelve qué hizo (o qué haría, en dry-run).
 *
 * @param {string[]} desired  etiquetas que el PR debería tener
 * @param {string[]} current  etiquetas que el PR tiene hoy
 */
export async function reconcilePrLabels(
  gh,
  prNumber,
  desired,
  current,
  { taxonomy, log = console.error } = {},
) {
  const desiredSet = new Set(desired)
  const currentSet = new Set(current)

  const toAdd = desired.filter((l) => !currentSet.has(l))
  const toRemove = current.filter((l) => isManagedLabel(l) && !desiredSet.has(l))

  if (toAdd.length === 0 && toRemove.length === 0) {
    log('::notice::etiquetas ya sincronizadas; sin escrituras')
    return { toAdd, toRemove, changed: false }
  }

  for (const name of toAdd) {
    await ensureLabel(gh, name, { taxonomy, log })
  }

  if (toAdd.length) {
    // POST es aditivo: no pisa las etiquetas fuera del namespace.
    await gh.rest('POST', `/repos/${gh.owner}/${gh.repo}/issues/${prNumber}/labels`, {
      body: { labels: toAdd },
      label: `agregar ${toAdd.join(', ')} a #${prNumber}`,
    })
  }

  for (const name of toRemove) {
    try {
      await gh.rest(
        'DELETE',
        `/repos/${gh.owner}/${gh.repo}/issues/${prNumber}/labels/${encodeURIComponent(name)}`,
        { label: `quitar ${name} de #${prNumber}` },
      )
    } catch (err) {
      // Alguien la sacó a mano entre el read y el delete: el estado ya es el deseado.
      if (!isNotFound(err)) throw err
    }
  }

  return { toAdd, toRemove, changed: true }
}

/** Crea todas las etiquetas del taxonomy de una (para el bootstrap / backfill). */
export async function ensureAllLabels(gh, { taxonomy, log = console.error } = {}) {
  const tax = taxonomy ?? (await loadTaxonomy())
  const created = []
  for (const name of tax.keys()) {
    if (await ensureLabel(gh, name, { taxonomy: tax, log })) created.push(name)
  }
  return created
}

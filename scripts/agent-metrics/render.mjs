/**
 * Presentación en markdown: job summary, issue de seguimiento y README del
 * tablero.
 *
 * Este módulo es donde las salvaguardas de honestidad se vuelven visibles. Las
 * reglas que aplica, todas deliberadas:
 *   - `n` va pegado a cada estadística
 *   - con n<5 no se imprimen percentiles, se imprimen los valores crudos
 *   - una tasa de 0 se imprime con su cota superior, no como "0%"
 *   - `open→merge` va rotulado como artefacto de auto-merge
 *   - si casi nada se revisó antes de mergear, arriba de todo va un bloque que
 *     lo dice, porque el resto de la sección de revisión mide ausencia
 */

export const TRACKER_MARKER = '<!-- agent-metrics-tracker -->'
export const PROVENANCE_MARKER = '<!-- agent-provenance -->'

const nf = (v, d = 1) =>
  v == null || !Number.isFinite(v)
    ? '—'
    : Number(v).toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: d,
      })

/** Distribución: percentiles si la muestra da, valores crudos si no. */
export function fmtDist(dist) {
  if (!dist || dist.n === 0) return '— *(sin datos)*'
  if (dist.insufficient) {
    return `**n=${dist.n}** · valores: ${dist.raw.map((v) => nf(v, 2)).join(', ')} ${dist.unit} *(muestra insuficiente para percentiles)*`
  }
  return `p50 **${nf(dist.p50, 2)}** · p75 ${nf(dist.p75, 2)} · p90 ${nf(dist.p90, 2)} ${dist.unit} *(n=${dist.n})*`
}

/** Tasa: con cero eventos se reporta la cota, nunca un "0%" pelado. */
export function fmtRate(r) {
  if (!r || r.value == null) return '— *(sin denominador)*'
  if (r.zeroEvents) {
    return `**0** de ${r.denominator} observados — cota superior 95% ≈ **${nf(r.upperBound95)}%** *(regla de tres; datos insuficientes para afirmar una tasa baja)*`
  }
  return `**${nf(r.value)}%** (${r.numerator}/${r.denominator})`
}

/** Bloque de advertencias. Va ARRIBA del reporte, no en una nota al pie. */
export function renderCaveats(metrics) {
  const dq = metrics.dataQuality
  const out = []

  if (!dq.reviewMetricsMeaningful) {
    const reviewed = metrics.cohorts.all.reviewedBeforeMerge
    out.push(
      `> [!WARNING]\n` +
        `> **${reviewed.numerator} de ${reviewed.denominator} merges** tuvieron algún feedback de revisión antes del merge.\n` +
        `> Las estadísticas de revisión de más abajo describen un proceso que en su mayoría no está ocurriendo:\n` +
        `> miden ausencia, no velocidad.`,
    )
  }

  if (dq.selfMergeShare >= 0.5) {
    out.push(
      `> [!NOTE]\n` +
        `> El **${nf(dq.selfMergeShare * 100)}%** de los PRs se mergeó a menos de 5 minutos de abrirse.\n` +
        `> \`open→merge\` mide el hábito de auto-mergear, no el throughput de revisión — por eso el reporte\n` +
        `> encabeza con *lead time to prod*, que es el único reloj que acá no está degenerado.`,
    )
  }

  if (!dq.agentMetricsMeaningful) {
    out.push(
      `> [!IMPORTANT]\n` +
        `> La cohorte de agentes tiene **${dq.agentCohortSize} PR(s)**. Cualquier comparación agente-vs-humano\n` +
        `> de abajo es anecdótica.` +
        (dq.agentCohortSize === 0
          ? `\n> Con cero PRs de agente, esto es lo esperable hasta que se activen los trailers de co-autoría\n> y el convenio de ramas \`claude/*\` (ver el README del script). El sistema mide una práctica que\n> todavía no deja rastro.`
          : ''),
    )
  }

  if (!dq.hotfixCountedInCFR) {
    const suspected = metrics.cohorts.all.failureBreakdown.suspected
    out.push(
      `> [!NOTE]\n` +
        `> El **change failure rate de arriba NO incluye la señal de hotfix**: se calibró contra este repo\n` +
        `> y marcó desarrollo secuencial sobre los mismos archivos como si fueran arreglos.\n` +
        `> Hay **${suspected}** PR(s) marcados como sospecha, listados abajo con su evidencia.\n` +
        `> Cuando la heurística esté calibrada, activala con \`--count-hotfix\`.`,
    )
  }

  if (dq.inferredLabels > 0) {
    out.push(
      `> [!NOTE]\n` +
        `> **${dq.inferredLabels}** PR(s) no tienen etiqueta y se clasificaron re-corriendo la detección sobre\n` +
        `> sus datos actuales. Corré el workflow con \`retag=true\` para fijar las etiquetas.`,
    )
  }

  return out.join('\n\n')
}

function cohortSection(c) {
  return [
    `| Métrica | Valor |`,
    `| --- | --- |`,
    `| Lead time a producción | ${fmtDist(c.leadTimeToProdH)} |`,
    `| Coding time (1er commit → merge) | ${fmtDist(c.codingTimeH)} |`,
    `| Open→merge *(auto-merge, no throughput)* | ${fmtDist(c.openToMergeMin)} |`,
    `| Iteraciones de revisión | ${fmtDist(c.reviewIterations)} |`,
    `| Revisado antes del merge | ${fmtRate(c.reviewedBeforeMerge)} |`,
    `| **Change failure rate** | ${fmtRate(c.changeFailureRate)} |`,
    `| **Revert rate** | ${fmtRate(c.revertRate)} |`,
    `| PRs / elegibles / muy recientes | ${c.total} / ${c.eligible} / ${c.excludedTooRecent} |`,
  ].join('\n')
}

function failureTable(records) {
  const flagged = records.filter((r) => r.failure.failed || r.failure.suspected)
  if (!flagged.length) return '_Ningún PR marcado como fallo en la ventana._'

  // URL absoluta derivada de la del propio PR. Un `../pull/N` relativo sólo
  // resuelve desde el issue de seguimiento; en el job summary (base
  // /owner/repo/actions/runs/…) y en el README del tablero (base
  // /users/owner/projects/N) da 404, y esos son dos de los tres destinos.
  const prUrl = (record, number) => String(record.url || '').replace(/\/\d+$/, `/${number}`)

  const rows = flagged.map((r) => {
    const f = r.failure
    const bits = []
    if (f.revert) bits.push(`revert \`${f.revert.oid}\` (${f.revert.matchedBy})`)
    if (f.hotfix) {
      bits.push(
        `${f.hotfix.weak ? '⚠️ sospecha: ' : ''}hotfix [#${f.hotfix.number}](${prUrl(r, f.hotfix.number)}) · solapamiento ${f.hotfix.overlapScore} · ${f.hotfix.overlap.slice(0, 3).join(', ')}`,
      )
    }
    if (f.deployFailure) bits.push(`deploy \`${f.deployFailure.state}\``)
    return `| [#${r.number}](${r.url}) | ${f.suspected ? 'Sospecha' : f.kind} | ${bits.join('<br>')} |`
  })

  return [
    '| PR | Señal | Evidencia |',
    '| --- | --- | --- |',
    ...rows,
    '',
    '> La señal de *hotfix* es una **sospecha**, no un hecho: compara conjuntos de archivos tras filtrar',
    '> docs y lockfiles. Es ciega a los bugs de `supabase/migrations/*`, que son archivos nuevos',
    '> append-only y por lo tanto nunca comparten ruta con la migración que arreglan.',
  ].join('\n')
}

function prTable(records, { limit = 30 } = {}) {
  const shown = records.slice(0, limit)
  const rows = shown.map(
    (r) =>
      `| [#${r.number}](${r.url}) | ${r.authorship}${r.inferred ? '*' : ''} | ${r.signals.join('+') || '—'} | ${nf(r.leadTimeToProdH, 2)} | ${nf(r.openToMergeMin, 1)} | ${r.review.iterations} | ${r.review.reviewedBeforeMerge ? '✅' : '—'} | ${r.failure.kind} |`,
  )
  const out = [
    '| PR | Autoría | Señales | Lead→prod (h) | Open→merge (min) | Iter. | Revisado | Fallo |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
  ]
  if (records.length > limit) out.push('', `_… y ${records.length - limit} PRs más._`)
  out.push('', '_`*` = autoría inferida en el momento del reporte, no etiquetada en el PR._')
  return out.join('\n')
}

/** Reporte completo: job summary y cuerpo del issue de seguimiento. */
export function renderReport(metrics, { title = 'Métricas de entrega de PRs de agentes' } = {}) {
  const { cohorts, dataQuality: dq } = metrics
  const windowLabel = metrics.since ? `desde ${metrics.since}` : 'todo el historial'

  const parts = [
    `# ${title}`,
    '',
    `Generado ${metrics.generatedAt} · rama base \`${metrics.base}\` · ventana: ${windowLabel} · **${dq.totalPRs} PRs**`,
    '',
  ]

  const caveats = renderCaveats(metrics)
  if (caveats) parts.push(caveats, '')

  parts.push(
    '## Cohorte de agentes',
    '',
    cohortSection(cohorts.agent),
    '',
    '## Cohorte humana *(control)*',
    '',
    '_Un change failure rate sin línea de base no se puede interpretar. Esta es la línea de base._',
    '',
    cohortSection(cohorts.human),
    '',
    '## Todos los PRs',
    '',
    cohortSection(cohorts.all),
    '',
    '## Fallos detectados',
    '',
    failureTable(metrics.records),
    '',
    '## Detalle por PR',
    '',
    prTable(metrics.records),
    '',
    '## Calidad del dato',
    '',
    '```json',
    JSON.stringify(dq, null, 2),
    '```',
  )

  return parts.join('\n')
}

/** Versión para el README del tablero: los agregados, sin la tabla larga. */
export function renderProjectReadme(metrics) {
  const { cohorts } = metrics
  const windowLabel = metrics.since ? `desde ${metrics.since}` : 'todo el historial'

  const parts = [
    '## Métricas de entrega',
    '',
    `_Actualizado ${metrics.generatedAt} · ${windowLabel}_`,
    '',
    '> Los campos de Projects v2 son por ítem: no existe almacenamiento de agregados en un tablero.',
    '> Por eso las tasas y percentiles viven acá, en el README, y no como campos.',
    '',
  ]

  const caveats = renderCaveats(metrics)
  if (caveats) parts.push(caveats, '')

  parts.push(
    '### Agentes',
    '',
    cohortSection(cohorts.agent),
    '',
    '### Humanos',
    '',
    cohortSection(cohorts.human),
  )
  return parts.join('\n')
}

/** Digest de una línea para shortDescription (tope ~150 caracteres). */
export function renderShortDescription(metrics) {
  const a = metrics.cohorts.agent
  const lead = a.leadTimeToProdH?.insufficient ? null : a.leadTimeToProdH?.p50
  const cfr = a.changeFailureRate
  const cfrTxt =
    cfr.value == null
      ? 'CFR s/d'
      : cfr.zeroEvents
        ? `CFR 0/${cfr.denominator}`
        : `CFR ${nf(cfr.value)}%`
  const reviewed = a.reviewedBeforeMerge
  const revTxt = reviewed.value == null ? '' : ` · ${nf(reviewed.value)}% revisado pre-merge`
  const leadTxt = lead == null ? 'lead s/d' : `p50 lead ${nf(lead, 1)}h`
  return `Agentes: ${a.total} PRs · ${leadTxt} · ${cfrTxt}${revTxt}`.slice(0, 150)
}

/** Cuerpo del issue de seguimiento (lleva el marcador para poder re-encontrarlo). */
export function renderTrackerIssue(metrics) {
  return [
    TRACKER_MARKER,
    '',
    renderReport(metrics, { title: 'Métricas de entrega — PRs de agentes' }),
    '',
    '---',
    '',
    '_Este issue lo reescribe `.github/workflows/agent-delivery-metrics.yml` en cada corrida._',
    '_Se agrega un comentario sólo cuando cambia algo material, para que el hilo sea un changelog y no un firehose._',
  ].join('\n')
}

/** Resumen de provenance del tagger, para el job summary. */
export function renderTagSummary({ prNumber, result, desired, reconcile, dryRun }) {
  const lines = [
    `## Tagger de PRs de agentes — #${prNumber}`,
    '',
    `**Veredicto:** ${result.isAgent ? '🤖 escrito por agente' : '👤 escrito por una persona'}${dryRun ? ' _(dry-run)_' : ''}`,
    '',
  ]

  if (result.signals.length) {
    lines.push('| Señal | Evidencia |', '| --- | --- |')
    for (const s of result.signals) {
      lines.push(`| \`${s}\` | \`${String(result.evidence[s] ?? '—')}\` |`)
    }
  } else {
    lines.push('_No disparó ninguna señal de agente._')
  }

  lines.push(
    '',
    `**Etiquetas deseadas:** ${desired.map((l) => `\`${l}\``).join(', ')}`,
    reconcile.changed
      ? `**Agregadas:** ${reconcile.toAdd.map((l) => `\`${l}\``).join(', ') || '—'} · **Quitadas:** ${reconcile.toRemove.map((l) => `\`${l}\``).join(', ') || '—'}`
      : '**Sin cambios** — las etiquetas ya estaban sincronizadas (cero escrituras).',
  )

  return lines.join('\n')
}

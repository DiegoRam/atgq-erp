/**
 * Cálculo de métricas de entrega.
 *
 * Todo el módulo está construido alrededor de un problema: con la muestra
 * actual (12 PRs, auto-mergeados en segundos, cero reverts), las cuatro
 * métricas pedidas dan números técnicamente correctos y engañosos. Un reporte
 * ingenuo diría "cycle time 0.5min · CFR 0% · revert rate 0%" y quien lo lea
 * concluiría que el proceso es excelente, cuando lo que el número mide es que
 * casi no hay proceso.
 *
 * De ahí las tres decisiones que atraviesan el archivo:
 *   - `n` viaja pegado a cada estadística, siempre
 *   - por debajo de n=5 no se publican percentiles, se publican los valores
 *   - una tasa de 0 sobre n chico se reporta con su cota superior (regla de 3),
 *     no como "0%"
 */

import { detect } from './detect.mjs'

const HOUR = 3_600_000
const MINUTE = 60_000
const DAY = 86_400_000

export const MIN_N_FOR_PERCENTILES = 5
export const DEFAULT_SETTLE_DAYS = 3
export const DEFAULT_HOTFIX_WINDOW_DAYS = 7
/** Piso duro: el deploy de producción de Vercel tarda 60–90s en resolver. */
export const MIN_SETTLE_MS = 15 * MINUTE

/**
 * Bots cuyos comentarios sueltos nunca son feedback (avisos de deploy, CI).
 *
 * Los bots revisores (coderabbitai, chatgpt-codex-connector, copilot) NO están
 * acá: no hace falta: sus IssueComment se descartan por ser de un Bot, y su
 * revisión real entra por PullRequestReview o por hilo inline. Ver el
 * comentario en reviewEventStream.
 */
const NOISE_BOTS = new Set(['vercel', 'github-actions', 'codecov'])

/**
 * Archivos que no cuentan para el solapamiento entre PRs.
 *
 * Sin este filtro la heurística de hotfix tiene 100% de falsos positivos:
 * los 12 PRs del repo tocan CHANGELOG.md, así que CUALQUIER par de PRs se
 * "solapa". Verificado contra el repo real, no supuesto.
 */
const IGNORED_PATHS = [
  /^CHANGELOG\.md$/i,
  /^PROGRESS\.md$/i,
  /^README\.md$/i,
  /^CLAUDE\.md$/i,
  /^docs\//i,
  /\.md$/i,
  /^package-lock\.json$/i,
  /^pnpm-lock\.yaml$/i,
  /^\.github\/workflows\//i,
]

const REVERT_HEADLINE_RE = /^revert\s+"|^revert(\([^)]*\))?!?:/i
const FIX_TITLE_RE = /^(fix|hotfix|revert)(\([^)]*\))?!?:/i

const normalizeLogin = (l) =>
  String(l || '')
    .replace(/\[bot\]$/i, '')
    .toLowerCase()

export const significantFiles = (paths) =>
  paths.filter((p) => !IGNORED_PATHS.some((re) => re.test(p)))

// ---------------------------------------------------------------------------
// Estadística
// ---------------------------------------------------------------------------

/**
 * Percentil por rango más cercano (nearest-rank), no interpolado.
 *
 * Con n=12, la interpolación tipo R-7 inventa valores entre dos observaciones
 * reales y sugiere una precisión que la muestra no tiene. Nearest-rank siempre
 * devuelve un valor que efectivamente ocurrió.
 */
export function quantile(values, q) {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!s.length) return null
  if (s.length === 1) return s[0]
  const rank = Math.ceil(q * s.length)
  return s[Math.min(Math.max(rank, 1), s.length) - 1]
}

const round = (v, d = 2) => (v == null ? null : Number(v.toFixed(d)))

/** Distribución con degradación honesta cuando la muestra no da. */
export function distribution(values, { unit = 'h', decimals = 2 } = {}) {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b)
  const base = {
    n: s.length,
    unit,
    min: round(s[0], decimals) ?? null,
    max: round(s.at(-1), decimals) ?? null,
  }
  if (s.length === 0) return { ...base, insufficient: true, raw: [] }
  if (s.length < MIN_N_FOR_PERCENTILES) {
    // Con n<5 un "p90" es el máximo con sombrero. Mostramos los datos crudos.
    return { ...base, insufficient: true, raw: s.map((v) => round(v, decimals)) }
  }
  return {
    ...base,
    insufficient: false,
    p50: round(quantile(s, 0.5), decimals),
    p75: round(quantile(s, 0.75), decimals),
    p90: round(quantile(s, 0.9), decimals),
  }
}

/**
 * Tasa con cota de confianza cuando no se observaron eventos.
 *
 * La regla de tres: con 0 eventos en n ensayos, el límite superior del 95% es
 * ~3/n. Reportar "0%" a secas con n=12 afirma algo que los datos no sostienen.
 */
export function rate(numerator, denominator) {
  if (!denominator) return { numerator, denominator, value: null, insufficient: true }
  const value = numerator / denominator
  const out = { numerator, denominator, value: round(value * 100, 1) }
  if (numerator === 0) {
    out.zeroEvents = true
    out.upperBound95 = round((3 / denominator) * 100, 1)
  }
  return out
}

// ---------------------------------------------------------------------------
// Tiempos de ciclo
// ---------------------------------------------------------------------------

const ts = (v) => (v ? new Date(v).getTime() : null)

export function firstCommitAt(pr) {
  const dates = (pr.commits || []).map((c) => ts(c.authoredDate)).filter(Number.isFinite)
  return dates.length ? Math.min(...dates) : null
}

/**
 * Tres relojes distintos. El que encabeza el reporte es `leadTimeToProd`:
 * es el "lead time for changes" de DORA de verdad, y es el único que no está
 * degenerado acá, porque el deploy a producción es trabajo real que ocurre
 * después del merge.
 *
 * `openToMerge` se calcula igual pero se rotula: con mediana de ~30 segundos
 * mide el hábito de auto-mergear, no la velocidad de revisión.
 */
export function cycleTimes(pr) {
  const merged = ts(pr.mergedAt)
  const created = ts(pr.createdAt)
  const first = firstCommitAt(pr)
  const deployAt = pr.deploy?.state === 'success' ? ts(pr.deploy.at) : null

  return {
    codingTimeH: first && merged ? (merged - first) / HOUR : null,
    openToMergeMin: created && merged ? (merged - created) / MINUTE : null,
    leadTimeToProdH: first && deployAt ? (deployAt - first) / HOUR : null,
    firstCommitAt: first ? new Date(first).toISOString() : null,
  }
}

// ---------------------------------------------------------------------------
// Iteraciones de revisión
// ---------------------------------------------------------------------------

/**
 * Convierte el timeline en un stream clasificado de FEEDBACK / RESPONSE.
 *
 * Qué NO es feedback, y por qué importa: los comentarios de vercel[bot] son
 * avisos de deploy, y los reviews APPROVED sin comentarios no piden nada. Si
 * contaran, todo PR con preview de Vercel parecería haber sido revisado.
 */
export function reviewEventStream(pr) {
  const authorLogin = normalizeLogin(pr.author?.login)
  const mergedAt = ts(pr.mergedAt) ?? Infinity
  const events = []

  // `PullRequestCommit` no expone la hora del PUSH, sólo la del commit, que
  // puede ser mucho anterior: si alguien commitea a las 11:00, le comentan a
  // las 14:00 y pushea a las 14:30, el evento ordenaría ANTES del feedback y
  // la ronda no se contaría (y el PR figuraría con feedback sin atender).
  // El timeline sí viene en orden de evento, así que para esos ítems —y sólo
  // para esos— se usa un tope monótono: su hora efectiva nunca es anterior a
  // la del ítem que lo precede en el timeline.
  let lastAt = -Infinity
  for (const item of pr.timeline || []) {
    const raw = ts(item.createdAt ?? item.commit?.committedDate)
    if (!Number.isFinite(raw)) continue
    const at = item.__typename === 'PullRequestCommit' ? Math.max(raw, lastAt) : raw
    lastAt = Math.max(lastAt, at)

    switch (item.__typename) {
      case 'PullRequestReview': {
        const login = normalizeLogin(item.author?.login)
        const hasSubstance =
          item.state === 'CHANGES_REQUESTED' || (item.comments?.totalCount ?? 0) > 0
        if (hasSubstance && login !== authorLogin && !NOISE_BOTS.has(login)) {
          events.push({ at, kind: 'FEEDBACK', source: `review:${login}`, state: item.state })
        }
        break
      }
      case 'IssueComment': {
        const login = normalizeLogin(item.author?.login)
        if (login === authorLogin) break
        // Un BOT nunca hace feedback por IssueComment. Cuando un bot revisa de
        // verdad emite un PullRequestReview o un hilo inline; sus comentarios
        // sueltos son resúmenes, avisos de deploy y errores de servicio.
        //
        // Esto no es teoría: en este repo el comentario que
        // chatgpt-codex-connector deja a los segundos de abrir cada PR dice
        // "You have reached your Codex usage limits for code reviews" — un
        // error de cuota. Contarlo como revisión hacía que "revisado antes del
        // merge" diera 91% en un repo donde casi nada se revisa. Justo el
        // dashboard en verde sobre un proceso que no ocurre que este módulo
        // existe para evitar.
        if (item.author?.__typename === 'Bot' || NOISE_BOTS.has(login)) break
        events.push({ at, kind: 'FEEDBACK', source: `comment:${login}` })
        break
      }
      case 'ReviewRequestedEvent':
        // PEDIR una revisión no es feedback: nadie dijo nada todavía. Contarlo
        // hacía que un PR con reviewer auto-asignado (CODEOWNERS) que jamás
        // fue revisado reportara `reviewedBeforeMerge: true`, y además armaba
        // la máquina de estados, así que el siguiente push fabricaba una
        // iteración inexistente. Se registra como REQUEST: queda en el stream
        // para depurar, pero no cuenta como feedback ni dispara una ronda.
        events.push({ at, kind: 'REQUEST', source: 'review-requested' })
        break
      case 'PullRequestCommit':
        events.push({ at, kind: 'RESPONSE', source: 'commit' })
        break
      case 'HeadRefForcePushedEvent':
        events.push({ at, kind: 'RESPONSE', source: 'force-push' })
        break
      default:
        break
    }
  }

  // Los hilos de revisión aportan su primer comentario como feedback: un
  // review inline puede no venir como PullRequestReview con comments>0.
  for (const thread of pr.reviewThreads || []) {
    const c = thread.comments?.nodes?.[0]
    const at = ts(c?.createdAt)
    const login = normalizeLogin(c?.author?.login)
    if (Number.isFinite(at) && login && login !== authorLogin && !NOISE_BOTS.has(login)) {
      events.push({ at, kind: 'FEEDBACK', source: `thread:${login}` })
    }
  }

  return events.filter((e) => e.at <= mergedAt).sort((a, b) => a.at - b.at)
}

/**
 * Una iteración = un ida y vuelta feedback→respuesta CERRADO antes del merge.
 *
 * Los FEEDBACK consecutivos colapsan en una sola ronda: tres comentarios de
 * CodeRabbit en veinte segundos son una pasada de revisión, no tres.
 * El feedback final sin push no se cuenta como iteración — se reporta aparte
 * como `unaddressedFeedback`, que es más informativo que inflar el número.
 */
export function reviewIterations(pr) {
  const stream = reviewEventStream(pr)
  const created = ts(pr.createdAt)

  let state = 'AWAITING_FEEDBACK'
  let iterations = 0
  let firstFeedbackAt = null
  let pushesAfterFirstFeedback = 0

  for (const ev of stream) {
    if (ev.kind === 'FEEDBACK') {
      if (firstFeedbackAt == null) firstFeedbackAt = ev.at
      state = 'AWAITING_RESPONSE'
    } else if (ev.kind === 'RESPONSE') {
      if (firstFeedbackAt != null) pushesAfterFirstFeedback++
      if (state === 'AWAITING_RESPONSE') {
        iterations++
        state = 'AWAITING_FEEDBACK'
      }
    }
  }

  const reviews = pr.reviews || []
  const botReviews = reviews.filter((r) => r.author?.__typename === 'Bot').length

  return {
    iterations,
    unaddressedFeedback: state === 'AWAITING_RESPONSE',
    reviewedBeforeMerge: firstFeedbackAt != null,
    timeToFirstFeedbackMin:
      firstFeedbackAt && created ? round((firstFeedbackAt - created) / MINUTE, 1) : null,
    formalReviews: reviews.length,
    botReviews,
    humanReviews: reviews.length - botReviews,
    reviewThreads: (pr.reviewThreads || []).length,
    unresolvedThreads: (pr.reviewThreads || []).filter((t) => !t.isResolved).length,
    pushesAfterFirstFeedback,
  }
}

// ---------------------------------------------------------------------------
// Fallos: revert, hotfix, deploy
// ---------------------------------------------------------------------------

/** Señal 1: un commit de revert en main que apunte a este PR. */
export function findRevert(pr, history) {
  const mergedAt = ts(pr.mergedAt)
  if (!mergedAt) return null
  const oids = new Set(
    [pr.mergeCommit?.oid, ...(pr.commits || []).map((c) => c.oid)].filter(Boolean),
  )
  const shortOids = [...oids].map((o) => o.slice(0, 7))
  const numRef = new RegExp(`#${pr.number}\\b`)

  for (const commit of history) {
    const at = ts(commit.committedDate)
    if (!Number.isFinite(at) || at <= mergedAt) continue
    if (!REVERT_HEADLINE_RE.test(commit.messageHeadline || '')) continue

    const blob = `${commit.messageHeadline || ''}\n${commit.messageBody || ''}`
    const hitsOid = shortOids.some((o) => blob.includes(o))
    const hitsNumber = numRef.test(blob)
    const hitsPr = (commit.associatedPullRequests?.nodes || []).some((p) => p.number === pr.number)

    if (hitsOid || hitsNumber || hitsPr) {
      return {
        oid: commit.oid.slice(0, 12),
        headline: commit.messageHeadline,
        at: commit.committedDate,
        matchedBy: hitsOid ? 'oid' : hitsNumber ? 'numero' : 'pr-asociado',
      }
    }
  }
  return null
}

/**
 * Señal 2: un PR de arreglo posterior que toca los mismos archivos.
 *
 * Es una SOSPECHA, no un hecho, y el reporte la muestra con su evidencia.
 * Dos límites conocidos:
 *   - falso positivo: sin el filtro de docs se dispara siempre (ver IGNORED_PATHS)
 *   - falso negativo sistemático: supabase/migrations/* son archivos nuevos
 *     append-only, así que una migración que arregla otra NUNCA comparte ruta
 *     con la que arregla. Esta señal es ciega a los bugs de migraciones.
 */
export function findHotfix(pr, allPrs, { windowDays = DEFAULT_HOTFIX_WINDOW_DAYS } = {}) {
  const mergedAt = ts(pr.mergedAt)
  if (!mergedAt) return null

  const mine = new Set(significantFiles((pr.files || []).map((f) => f.path)))
  if (mine.size === 0) return null

  const candidates = allPrs
    .filter((other) => {
      if (other.number === pr.number) return false
      // Misma rama de origen = el mismo trabajo partido en dos PRs, no un
      // arreglo de algo roto. En este repo pasa de verdad: #8 y #9 comparten
      // `feat/eliminar-catalogos` y se solapaban al 100%.
      if (other.headRefName && other.headRefName === pr.headRefName) return false
      const otherAt = ts(other.mergedAt)
      if (!Number.isFinite(otherAt)) return false
      const delta = otherAt - mergedAt
      return delta > 0 && delta <= windowDays * DAY && FIX_TITLE_RE.test(other.title || '')
    })
    .sort((a, b) => ts(a.mergedAt) - ts(b.mergedAt))

  for (const other of candidates) {
    // Un archivo recién creado en el PR de arreglo no puede estar arreglando
    // algo preexistente: se descarta del solapamiento.
    const theirPaths = significantFiles(
      (other.files || []).filter((f) => f.changeType !== 'ADDED').map((f) => f.path),
    )
    const overlap = theirPaths.filter((p) => mine.has(p))
    if (!overlap.length) continue

    const denom = significantFiles((other.files || []).map((f) => f.path)).length || 1
    const overlapScore = overlap.length / denom
    return {
      number: other.number,
      title: other.title,
      at: other.mergedAt,
      overlap,
      overlapScore: round(overlapScore, 2),
      // Por debajo de 0.2 el solapamiento es incidental; queda como sospecha
      // y no entra en el CFR de portada.
      weak: overlapScore < 0.2,
    }
  }
  return null
}

/** Señal 3: el deploy de producción del merge commit falló. */
export function findDeployFailure(pr) {
  const state = pr.deploy?.state
  if (state === 'failure' || state === 'error') {
    return { state, at: pr.deploy.at ?? null, environment: pr.deploy.environment ?? null }
  }
  return null
}

// ---------------------------------------------------------------------------
// Ensamblado
// ---------------------------------------------------------------------------

/** Clasificación de autoría, priorizando la etiqueta ya aplicada al PR. */
export function classify(pr) {
  const labels = pr.labels || []
  if (labels.includes('agent-authored')) {
    return {
      authorship: 'Agent',
      signals: labels.filter((l) => l.startsWith('agent:')).map((l) => l.slice(6)),
    }
  }
  if (labels.includes('human-authored')) return { authorship: 'Human', signals: [] }
  // Sin etiqueta: recalculamos. Así el reporte funciona antes del backfill.
  const d = detect(pr)
  return { authorship: d.isAgent ? 'Agent' : 'Human', signals: d.signals, inferred: true }
}

/** Un registro por PR, con toda la evidencia adjunta. */
export function buildRecords(
  prs,
  history,
  {
    settleDays = DEFAULT_SETTLE_DAYS,
    hotfixWindowDays = DEFAULT_HOTFIX_WINDOW_DAYS,
    countHotfix = false,
    now = Date.now(),
  } = {},
) {
  const settleMs = Math.max(settleDays * DAY, MIN_SETTLE_MS)

  return prs.map((pr) => {
    const { authorship, signals, inferred } = classify(pr)
    const times = cycleTimes(pr)
    const review = reviewIterations(pr)

    const revert = findRevert(pr, history)
    const hotfix = findHotfix(pr, prs, { windowDays: hotfixWindowDays })
    const deployFailure = findDeployFailure(pr)

    const mergedAt = ts(pr.mergedAt)
    // Un merge demasiado reciente no tiene veredicto todavía: el deploy puede
    // seguir en `pending` y el hotfix aún no pudo ocurrir. Se excluye del
    // denominador y se muestra, no se descarta en silencio.
    const tooRecent = !Number.isFinite(mergedAt) || now - mergedAt < settleMs

    /**
     * La señal de hotfix NO cuenta para el CFR de portada salvo que se pida
     * con `countHotfix`.
     *
     * No es timidez: se calibró contra los 11 PRs del repo y marcó 5. Al
     * mirarlos uno por uno, casi todos son desarrollo secuencial sobre los
     * mismos archivos (#2→#3, #3→#9), no arreglos de algo roto. Publicar un
     * CFR de 45% construido sobre eso es el mismo pecado que publicar un 0%:
     * un número con cara de medición que en realidad es un artefacto.
     *
     * Queda registrado como `suspected`, con su evidencia y su score, para que
     * se pueda calibrar mirando un trimestre de banderas antes de promoverlo.
     */
    const countedHotfix = hotfix && !hotfix.weak && countHotfix
    const strongFailures = [
      revert && 'Revert',
      countedHotfix && 'Hotfix',
      deployFailure && 'Deploy',
    ].filter(Boolean)

    return {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      nodeId: pr.id,
      authorship,
      signals,
      inferred: Boolean(inferred),
      author: pr.author?.login ?? null,
      headRefName: pr.headRefName,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      mergeCommit: pr.mergeCommit?.oid ?? null,
      changedFiles: pr.changedFiles,
      additions: pr.additions,
      deletions: pr.deletions,
      ...times,
      codingTimeH: round(times.codingTimeH, 2),
      openToMergeMin: round(times.openToMergeMin, 2),
      leadTimeToProdH: round(times.leadTimeToProdH, 2),
      review,
      deploy: pr.deploy ?? null,
      failure: {
        tooRecent,
        revert,
        hotfix,
        deployFailure,
        // `Multiple` sólo cuando hay más de una señal fuerte. Un hotfix débil
        // no cambia el kind: queda registrado en `suspected`.
        kind:
          strongFailures.length === 0
            ? 'None'
            : strongFailures.length === 1
              ? strongFailures[0]
              : 'Multiple',
        failed: strongFailures.length > 0,
        // Sospecha = hay señal de hotfix que no entró al CFR (por débil o
        // porque countHotfix está apagado) y ninguna señal fuerte la respalda.
        suspected: Boolean(hotfix) && !countedHotfix && strongFailures.length === 0,
        hotfixCounted: Boolean(countedHotfix),
      },
    }
  })
}

/** Resumen de una cohorte (Agent / Human). */
export function summarizeCohort(records, label) {
  const eligible = records.filter((r) => !r.failure.tooRecent)
  const failed = eligible.filter((r) => r.failure.failed)
  const reverted = eligible.filter((r) => r.failure.revert)
  const reviewed = records.filter((r) => r.review.reviewedBeforeMerge)

  return {
    cohort: label,
    total: records.length,
    eligible: eligible.length,
    excludedTooRecent: records.length - eligible.length,
    leadTimeToProdH: distribution(records.map((r) => r.leadTimeToProdH).filter(Number.isFinite)),
    codingTimeH: distribution(records.map((r) => r.codingTimeH).filter(Number.isFinite)),
    openToMergeMin: distribution(records.map((r) => r.openToMergeMin).filter(Number.isFinite), {
      unit: 'min',
      decimals: 1,
    }),
    reviewIterations: distribution(
      records.map((r) => r.review.iterations),
      {
        unit: 'rondas',
        decimals: 1,
      },
    ),
    reviewedBeforeMerge: rate(reviewed.length, records.length),
    changeFailureRate: rate(failed.length, eligible.length),
    revertRate: rate(reverted.length, eligible.length),
    failureBreakdown: {
      revert: eligible.filter((r) => r.failure.revert).length,
      hotfix: eligible.filter((r) => r.failure.hotfixCounted).length,
      deploy: eligible.filter((r) => r.failure.deployFailure).length,
      // Banderas de hotfix que NO entraron al CFR. Se muestran para poder
      // calibrar la heurística, no para inflar la tasa.
      suspected: eligible.filter((r) => r.failure.suspected).length,
    },
  }
}

/**
 * Señales de calidad del dato. Existen para que quien consuma el JSON pueda
 * decidir no mostrar los números, en vez de mostrarlos con una nota al pie que
 * nadie lee.
 */
export function dataQuality(records, { since, base, windowDays }) {
  const n = records.length || 1
  const selfMerged = records.filter((r) => r.openToMergeMin != null && r.openToMergeMin < 5).length
  const unreviewed = records.filter((r) => !r.review.reviewedBeforeMerge).length
  const agents = records.filter((r) => r.authorship === 'Agent')

  return {
    windowSince: since,
    baseBranch: base,
    windowDays: windowDays ?? null,
    totalPRs: records.length,
    agentCohortSize: agents.length,
    inferredLabels: records.filter((r) => r.inferred).length,
    selfMergeShare: round(selfMerged / n, 2),
    unreviewedShare: round(unreviewed / n, 2),
    // La bandera que dice "no publiques estos números como si midieran velocidad".
    reviewMetricsMeaningful: unreviewed / n < 0.5,
    agentMetricsMeaningful: agents.length >= MIN_N_FOR_PERCENTILES,
  }
}

export function computeMetrics(collected, options = {}) {
  const records = buildRecords(collected.prs, collected.history, options)
  const agent = records.filter((r) => r.authorship === 'Agent')
  const human = records.filter((r) => r.authorship === 'Human')

  return {
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    since: collected.since,
    base: collected.base,
    records,
    cohorts: {
      agent: summarizeCohort(agent, 'Agent'),
      human: summarizeCohort(human, 'Human'),
      all: summarizeCohort(records, 'Todos'),
    },
    dataQuality: {
      ...dataQuality(records, {
        since: collected.since,
        base: collected.base,
        windowDays: options.windowDays,
      }),
      // Explícito en el JSON: quien lo consuma tiene que saber qué señales
      // entraron al CFR que está leyendo.
      hotfixCountedInCFR: Boolean(options.countHotfix),
    },
  }
}

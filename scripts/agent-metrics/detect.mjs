/**
 * Predicado de detección de autoría por agente. Compartido por el tagger y el
 * colector: si divergieran, un PR podría quedar etiquetado de una forma y
 * medido de otra, y la cohorte del reporte dejaría de significar algo.
 *
 * Cuatro señales, cualquiera alcanza. Se registra CUÁL disparó, porque
 * "trailer" (el agente firmó el commit) y "branch" (alguien nombró la rama
 * claude/algo) tienen credibilidad muy distinta.
 */

/** Trailer del commit. Ojo: vive en el CUERPO, nunca en el headline. */
const TRAILER_RE = /^[ \t]*co-authored-by:[ \t]*claude\b/im
const ANTHROPIC_RE = /^[ \t]*co-authored-by:.*<[^>]*@anthropic\.com>/im
const GENERATED_RE = /generated with \[?claude code/i

/** Prefijo de rama: claude/foo, agent-foo, codex/bar... */
const BRANCH_RE = /^(claude|agent|ai|codex|bot)[/-]/i

/**
 * Marcador en el cuerpo del PR. Dos formas:
 *   - el comentario HTML explícito `<!-- agent-authored: true -->`
 *   - una casilla marcada que lleve el sentinel literal `agent-authored`
 *
 * La casilla EXIGE el sentinel a propósito. La plantilla de PR tiene más
 * arriba una casilla "agent-browser sobre las pantallas afectadas": un regex
 * que aceptara cualquier casilla marcada con la palabra "agent" clasificaría
 * como escrito-por-agente a todo PR que hubiera pasado por el navegador.
 */
const MARKER_COMMENT_RE = /<!--\s*agent-authored:\s*true\s*-->/i
const MARKER_CHECKBOX_RE = /^[ \t]*[-*][ \t]*\[[xX]\][^\n]*agent-authored/m

/**
 * Bots que NO son agentes de codificación a estos efectos. Se chequea ANTES
 * que la señal de actor: sin esto, cada PR de dependabot y cada review de
 * CodeRabbit entrarían a la cohorte de agentes y el CFR mediría otra cosa.
 */
const NOT_AGENTS = new Set([
  'dependabot',
  'renovate',
  'vercel',
  'coderabbitai',
  'chatgpt-codex-connector',
  'github-actions',
  'codecov',
  'snyk-bot',
])

/** Cuentas/Apps que sí son agentes de codificación. */
const AGENT_ACTORS = new Set([
  'claude',
  'claude-bot',
  'claude-code',
  'devin-ai-integration',
  'cursor',
  'cursoragent',
  'copilot-swe-agent',
  'google-labs-jules',
])

export const SIGNALS = ['trailer', 'branch', 'marker', 'actor']

const normalizeLogin = (login) =>
  String(login || '')
    .replace(/\[bot\]$/i, '')
    .toLowerCase()

/**
 * @param {{ headRefName?: string, body?: string, author?: {login?: string, __typename?: string, type?: string},
 *           commits?: Array<{oid?: string, message?: string}> }} pr
 * @returns {{ isAgent: boolean, signals: string[], evidence: Record<string, unknown> }}
 */
export function detect(pr) {
  const signals = []
  const evidence = {}

  const commits = Array.isArray(pr?.commits) ? pr.commits : []
  const trailerHit = commits.find((c) => {
    const m = c?.message ?? ''
    return TRAILER_RE.test(m) || ANTHROPIC_RE.test(m) || GENERATED_RE.test(m)
  })
  if (trailerHit) {
    signals.push('trailer')
    evidence.trailer = trailerHit.oid ? String(trailerHit.oid).slice(0, 12) : true
  }

  const branch = pr?.headRefName ?? ''
  if (BRANCH_RE.test(branch)) {
    signals.push('branch')
    evidence.branch = branch
  }

  const body = pr?.body ?? ''
  if (MARKER_COMMENT_RE.test(body) || MARKER_CHECKBOX_RE.test(body)) {
    signals.push('marker')
    evidence.marker = MARKER_COMMENT_RE.test(body) ? 'comment' : 'checkbox'
  }

  // Sólo cuentan las cuentas de agente conocidas. "Es un bot" NO alcanza: con
  // esa regla, cualquier app que se instale después (mergify, pre-commit-ci,
  // imgbot, sonarcloud) entraría a la cohorte de agentes y se llevaría una
  // etiqueta permanente, contaminando el denominador del CFR — justo lo que
  // NOT_AGENTS intenta evitar. Ante un bot desconocido, el default correcto es
  // "no es un agente de codificación", no al revés.
  const login = normalizeLogin(pr?.author?.login)
  if (login && !NOT_AGENTS.has(login) && AGENT_ACTORS.has(login)) {
    signals.push('actor')
    evidence.actor = pr.author.login
  }

  return { isAgent: signals.length > 0, signals, evidence }
}

/**
 * Etiquetas que el PR debería tener según la detección.
 * Se emite `human-authored` explícito: la AUSENCIA de `agent-authored` es
 * ambigua entre "lo escribió una persona" y "es anterior al sistema", y esa
 * diferencia es justo el denominador del reporte.
 */
export function desiredLabels(result) {
  const base = result.isAgent ? ['agent-authored'] : ['human-authored']
  return [...base, ...result.signals.map((s) => `agent:${s}`)]
}

/** Namespace que el tagger puede borrar. Nunca toca bug/enhancement/etc. */
export function isManagedLabel(name) {
  return name === 'agent-authored' || name === 'human-authored' || name.startsWith('agent:')
}

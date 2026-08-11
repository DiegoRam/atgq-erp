/**
 * Cliente mínimo de la API de GitHub (REST + GraphQL) sin dependencias.
 *
 * Por qué a mano y no @octokit: estos scripts corren con `node` pelado desde un
 * workflow y desde la terminal. Agregar una dependencia obligaría a un `npm ci`
 * en CI y a meter `scripts/` en el grafo de build de Next, que es justo lo que
 * queremos evitar. `fetch` global alcanza.
 *
 * Responsabilidades:
 *   - reintentos con backoff + jitter (502/503/504, 429, RATE_LIMITED, secundario)
 *   - guardia de rate limit primario (duerme hasta resetAt si queda poco)
 *   - piso de ~150ms entre mutaciones (rate limit secundario de Projects v2)
 *   - INSUFFICIENT_SCOPES como fallo BLANDO: lo reporta, no lo tira
 *   - modo dry-run que lee de la API real pero cortocircuita TODA escritura
 *
 * El dry-run se aplica acá adentro a propósito. Si cada caller tuviera que
 * acordarse de chequear la bandera, alcanzaría con un olvido para escribir en
 * producción durante una prueba. Centralizado, la garantía es estructural.
 */

const API_URL = process.env.GITHUB_API_URL || 'https://api.github.com'
const GRAPHQL_URL = process.env.GITHUB_GRAPHQL_URL || `${API_URL}/graphql`

const MAX_ATTEMPTS = 4
const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504])
const RATE_LIMIT_FLOOR = 100
const MUTATION_MIN_INTERVAL_MS = 150

export class GitHubError extends Error {
  constructor(message, { status, errors, type, query } = {}) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
    this.errors = errors
    this.type = type
    this.query = query
  }
}

/** Un token sin los scopes necesarios (típicamente `project`) no es un bug: es config faltante. */
export function isInsufficientScopes(err) {
  if (!(err instanceof GitHubError)) return false
  if (err.type === 'INSUFFICIENT_SCOPES') return true
  return (err.errors || []).some((e) => e.type === 'INSUFFICIENT_SCOPES')
}

export function isNotFound(err) {
  return err instanceof GitHubError && (err.status === 404 || err.type === 'NOT_FOUND')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Backoff exponencial con jitter completo: evita que reintentos paralelos se sincronicen. */
function backoffMs(attempt) {
  const base = Math.min(1000 * 2 ** (attempt - 1), 30_000)
  return Math.floor(base / 2 + Math.random() * (base / 2))
}

/** Camino con puntos sobre un objeto, tolerante a nulls: getPath(o, 'a.b.c'). */
export function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj)
}

export function createClient({
  token,
  repo,
  userAgent = 'atgq-erp-agent-metrics',
  dryRun = false,
  verbose = false,
  noWait = false,
  log = console.error,
} = {}) {
  if (!token) throw new Error('Falta el token de GitHub (GH_TOKEN / GITHUB_TOKEN)')

  const [owner, name] = String(repo || process.env.GH_REPO || '').split('/')
  if (!owner || !name) throw new Error('Falta el repo en formato owner/name (GH_REPO)')

  const stats = { graphql: 0, rest: 0, writes: 0, writesSkipped: 0, retries: 0 }
  let lastRateLimit = null
  let lastMutationAt = 0

  const debug = (...a) => verbose && log('[gh]', ...a)

  async function guardRateLimit() {
    if (!lastRateLimit || lastRateLimit.remaining == null) return
    if (lastRateLimit.remaining > RATE_LIMIT_FLOOR) return
    const resetAt = new Date(lastRateLimit.resetAt).getTime()
    const waitMs = resetAt - Date.now() + 1000
    if (waitMs <= 0) return
    if (noWait) {
      throw new GitHubError(
        `Rate limit casi agotado (${lastRateLimit.remaining}) y --no-wait activo; reset ${lastRateLimit.resetAt}`,
        { type: 'RATE_LIMITED' },
      )
    }
    log(`[gh] rate limit bajo (${lastRateLimit.remaining}); esperando ${Math.ceil(waitMs / 1000)}s`)
    await sleep(waitMs)
  }

  /** Piso entre mutaciones. Barato acá (decenas de requests), y evita el límite secundario. */
  async function throttleMutation() {
    const since = Date.now() - lastMutationAt
    if (since < MUTATION_MIN_INTERVAL_MS) await sleep(MUTATION_MIN_INTERVAL_MS - since)
    lastMutationAt = Date.now()
  }

  function headers(extra = {}, overrideToken) {
    return {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${overrideToken || token}`,
      'user-agent': userAgent,
      'x-github-api-version': '2022-11-28',
      ...extra,
    }
  }

  /** Un 403 con "secondary rate limit" trae Retry-After y se reintenta; el resto no. */
  function retryDelayFromResponse(res) {
    const retryAfter = Number(res.headers.get('retry-after'))
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    if (Number.isFinite(reset) && reset > 0) {
      const ms = reset * 1000 - Date.now() + 1000
      if (ms > 0 && ms < 15 * 60_000) return ms
    }
    return null
  }

  /**
   * `wantLink` devuelve `{ body, link }` en vez del cuerpo pelado, para que la
   * paginación REST pueda leer el header Link sin salirse de esta función —
   * que es la única que tiene reintentos, backoff y guardia de rate limit.
   */
  async function request(url, init, { isWrite = false, label = '', wantLink = false } = {}) {
    const wrap = (body, link = null) => (wantLink ? { body, link } : body)

    if (isWrite && dryRun) {
      stats.writesSkipped++
      log(`[dry-run] omitida escritura: ${label || url}`)
      return wrap({ dryRun: true })
    }
    if (isWrite) {
      await throttleMutation()
      stats.writes++
    }

    let lastErr
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let res
      try {
        res = await fetch(url, init)
      } catch (cause) {
        // Fallo de red: reintentable.
        lastErr = new GitHubError(`Fallo de red hacia ${url}: ${cause.message}`, {})
        if (attempt === MAX_ATTEMPTS) throw lastErr
        stats.retries++
        await sleep(backoffMs(attempt))
        continue
      }

      if (res.status === 204) return wrap(null)

      const text = await res.text()
      let body = null
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = { message: text }
        }
      }

      if (res.ok) return wrap(body, res.headers.get('link'))

      const secondary = res.status === 403 && /secondary rate limit|abuse detection/i.test(text)
      if (RETRIABLE_STATUS.has(res.status) || secondary) {
        if (attempt === MAX_ATTEMPTS) {
          throw new GitHubError(`${res.status} tras ${MAX_ATTEMPTS} intentos: ${body?.message}`, {
            status: res.status,
            errors: body?.errors,
          })
        }
        stats.retries++
        const delay = retryDelayFromResponse(res) ?? backoffMs(attempt)
        debug(`${res.status} en ${label || url}; reintento ${attempt} en ${delay}ms`)
        await sleep(delay)
        continue
      }

      throw new GitHubError(body?.message || `HTTP ${res.status}`, {
        status: res.status,
        errors: body?.errors,
      })
    }
    throw lastErr
  }

  /**
   * GraphQL. Si el documento pide `rateLimit`, lo consumimos para la guardia.
   * `overrideToken` existe porque el sync de Projects v2 usa el PAT mientras el
   * resto del script sigue con el GITHUB_TOKEN del workflow.
   */
  async function graphql(query, variables = {}, { overrideToken, label } = {}) {
    const isMutation = /^\s*mutation\b/.test(query)
    await guardRateLimit()
    stats.graphql++

    const body = await request(
      GRAPHQL_URL,
      {
        method: 'POST',
        headers: headers({ 'content-type': 'application/json' }, overrideToken),
        body: JSON.stringify({ query, variables }),
      },
      { isWrite: isMutation, label: label || (isMutation ? 'graphql mutation' : 'graphql query') },
    )

    if (body?.dryRun) return body

    if (body?.errors?.length) {
      const first = body.errors[0]
      throw new GitHubError(first.message || 'Error de GraphQL', {
        errors: body.errors,
        type: first.type,
        query: label,
      })
    }

    if (body?.data?.rateLimit) lastRateLimit = body.data.rateLimit
    return body?.data
  }

  async function rest(method, path, { body, overrideToken, label } = {}) {
    const isWrite = method !== 'GET' && method !== 'HEAD'
    stats.rest++
    const url = path.startsWith('http') ? path : `${API_URL}${path}`
    return request(
      url,
      {
        method,
        headers: headers(body ? { 'content-type': 'application/json' } : {}, overrideToken),
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
      { isWrite, label: label || `${method} ${path}` },
    )
  }

  /**
   * Paginación REST por header Link. Devuelve el array concatenado.
   *
   * Pasa por `request()` como todo lo demás: cuando llamaba a `fetch` directo
   * se salteaba los reintentos, el backoff y la guardia de rate limit, así que
   * un solo 502 transitorio sobre `/pulls/N/commits` dejaba el tagger en rojo
   * en un PR cualquiera.
   */
  async function restPaginate(path, { max = Infinity, overrideToken, label } = {}) {
    const out = []
    let url = path.startsWith('http') ? path : `${API_URL}${path}`
    while (url && out.length < max) {
      stats.rest++
      const { body, link } = await request(
        url,
        { method: 'GET', headers: headers({}, overrideToken) },
        { wantLink: true, label: label || `GET ${path}` },
      )
      out.push(...(Array.isArray(body) ? body : []))
      const next = (link || '').match(/<([^>]+)>;\s*rel="next"/)
      url = next ? next[1] : null
    }
    return max === Infinity ? out : out.slice(0, max)
  }

  /**
   * Paginación GraphQL sobre una conexión con cursor.
   * `path` apunta a la conexión dentro de `data` (p.ej. 'repository.pullRequest.commits').
   *
   * Nunca usamos `totalCount` para decidir cuándo parar: en `timelineItems` con
   * filtro `itemTypes` viene mal (cuenta ítems que el filtro después descarta).
   * La única fuente de verdad es `pageInfo.hasNextPage`.
   */
  async function graphqlPaginate(
    query,
    variables,
    { path, max = 1000, label, overrideToken, startCursor = null } = {},
  ) {
    const nodes = []
    // `startCursor` continúa una conexión que ya venía truncada de otra consulta.
    // Va por opciones y no por `variables` porque el loop pisa `after` en cada
    // vuelta: si viniera en `variables`, la primera vuelta lo borraría y
    // volveríamos a traer la página 1 duplicada.
    let after = startCursor
    let guard = 0
    for (;;) {
      const data = await graphql(query, { ...variables, after }, { label, overrideToken })
      const conn = getPath(data, path)
      if (!conn) {
        // Un nodo intermedio nulo (una rama que no existe, p.ej.) es
        // indistinguible de una conexión vacía si se sale en silencio: el
        // historial volvería vacío y el reporte diría "cero reverts" sobre
        // datos que nunca se trajeron. En la primera página se avisa.
        if (nodes.length === 0) {
          log(`::warning::${path} vino nulo${label ? ` en "${label}"` : ''}; se devuelve vacío`)
        }
        break
      }
      nodes.push(...(conn.nodes || []))
      if (!conn.pageInfo?.hasNextPage || nodes.length >= max) break
      after = conn.pageInfo.endCursor
      if (++guard > 100) {
        log(`[gh] corte de seguridad paginando ${path} (>100 páginas)`)
        break
      }
    }
    return nodes
  }

  return {
    owner,
    repo: name,
    dryRun,
    stats,
    graphql,
    graphqlPaginate,
    rest,
    restPaginate,
    get rateLimit() {
      return lastRateLimit
    },
  }
}

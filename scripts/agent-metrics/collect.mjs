/**
 * Recolección de hechos crudos sobre los PRs mergeados. Nada de métricas acá:
 * este módulo solo trae datos y los normaliza. El cálculo vive en metrics.mjs.
 *
 * Cuatro fases, separadas a propósito. Una sola consulta que cruce
 * commits × files × timeline sobre 25 PRs revienta el límite de nodos de
 * GraphQL, y cuando revienta lo hace devolviendo un error genérico que cuesta
 * diagnosticar.
 *
 *   1. enumerar   — `search` filtra por fecha de merge del lado del servidor
 *   2. detalle    — consultas con alias, de a 5 PRs
 *   3. reverts    — un solo barrido del historial de main
 *   4. deploys    — REST (los estados de deployment no salen bien por GraphQL)
 */

import { getPath } from './gh.mjs'

const DETAIL_BATCH = 5

/** `all` | `90d` | `2026-01-31`. Devuelve null para "todo el historial". */
export function parseSince(input) {
  const raw = String(input ?? '90d').trim()
  if (!raw || raw === 'all') return null
  const rel = raw.match(/^(\d+)d$/i)
  if (rel) {
    const d = new Date(Date.now() - Number(rel[1]) * 86_400_000)
    return d.toISOString().slice(0, 10)
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) throw new Error(`No entiendo --since "${raw}"`)
  return parsed.toISOString().slice(0, 10)
}

const SEARCH_QUERY = `
query($q: String!, $after: String) {
  rateLimit { cost remaining resetAt }
  search(query: $q, type: ISSUE, first: 50, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        id number title url
        createdAt mergedAt closedAt
        headRefName baseRefName isCrossRepository
        additions deletions changedFiles
        author { login __typename }
        body
        labels(first: 30) { nodes { name } }
        mergeCommit { oid committedDate }
      }
    }
  }
}`

const PR_DETAIL_FRAGMENT = `
fragment PRDetail on PullRequest {
  number
  commits(first: 100) {
    totalCount
    pageInfo { hasNextPage endCursor }
    nodes { commit {
      oid messageHeadline messageBody authoredDate committedDate
      author { name email user { login } }
    } }
  }
  files(first: 100) {
    totalCount
    pageInfo { hasNextPage endCursor }
    nodes { path additions deletions changeType }
  }
  reviews(first: 100) {
    totalCount
    pageInfo { hasNextPage endCursor }
    nodes { state createdAt submittedAt author { login __typename } comments { totalCount } }
  }
  reviewThreads(first: 100) {
    totalCount
    pageInfo { hasNextPage endCursor }
    nodes { isResolved isOutdated comments(first: 1) { nodes { createdAt author { login __typename } } } }
  }
  timelineItems(first: 100, itemTypes: [
    PULL_REQUEST_COMMIT, ISSUE_COMMENT, PULL_REQUEST_REVIEW,
    REVIEW_REQUESTED_EVENT, HEAD_REF_FORCE_PUSHED_EVENT, READY_FOR_REVIEW_EVENT
  ]) {
    pageInfo { hasNextPage endCursor }
    nodes {
      __typename
      ... on PullRequestCommit { commit { oid committedDate } }
      ... on IssueComment { createdAt author { login __typename } }
      ... on PullRequestReview { createdAt state author { login __typename } comments { totalCount } }
      ... on ReviewRequestedEvent { createdAt }
      ... on HeadRefForcePushedEvent { createdAt }
      ... on ReadyForReviewEvent { createdAt }
    }
  }
  closingIssuesReferences(first: 10) { nodes { number title closedAt } }
}`

const COMMITS_PAGE_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      commits(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { commit { oid messageHeadline messageBody authoredDate committedDate
                         author { name email user { login } } } }
      }
    }
  }
}`

const FILES_PAGE_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      files(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { path additions deletions changeType }
      }
    }
  }
}`

const REVIEWS_PAGE_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviews(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { state createdAt submittedAt author { login __typename } comments { totalCount } }
      }
    }
  }
}`

const REVIEW_THREADS_PAGE_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { isResolved isOutdated comments(first: 1) { nodes { createdAt author { login __typename } } } }
      }
    }
  }
}`

const TIMELINE_PAGE_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      timelineItems(first: 100, after: $after, itemTypes: [
        PULL_REQUEST_COMMIT, ISSUE_COMMENT, PULL_REQUEST_REVIEW,
        REVIEW_REQUESTED_EVENT, HEAD_REF_FORCE_PUSHED_EVENT, READY_FOR_REVIEW_EVENT
      ]) {
        pageInfo { hasNextPage endCursor }
        nodes {
          __typename
          ... on PullRequestCommit { commit { oid committedDate } }
          ... on IssueComment { createdAt author { login __typename } }
          ... on PullRequestReview { createdAt state author { login __typename } comments { totalCount } }
          ... on ReviewRequestedEvent { createdAt }
          ... on HeadRefForcePushedEvent { createdAt }
          ... on ReadyForReviewEvent { createdAt }
        }
      }
    }
  }
}`

const HISTORY_QUERY = `
query($owner: String!, $repo: String!, $since: GitTimestamp!, $branch: String!, $after: String) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: $branch) {
      target { ... on Commit {
        history(first: 100, since: $since, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            oid messageHeadline messageBody committedDate
            associatedPullRequests(first: 3) { nodes { number } }
          }
        }
      } }
    }
  }
}`

/** Fase 1: qué PRs entran en la ventana. */
export async function enumeratePRs(gh, { since, base = 'main', max = 500, log = console.error }) {
  const parts = [`repo:${gh.owner}/${gh.repo}`, 'is:pr', 'is:merged', `base:${base}`]
  if (since) parts.push(`merged:>=${since}`)
  const q = `${parts.join(' ')} sort:updated-desc`
  log(`[collect] buscando: ${q}`)

  const nodes = await gh.graphqlPaginate(
    SEARCH_QUERY,
    { q },
    { path: 'search', max, label: 'search PRs' },
  )
  // `search` puede colar nodos vacíos si un resultado no es PullRequest.
  return nodes.filter((n) => n && typeof n.number === 'number')
}

function buildDetailQuery(numbers) {
  const params = numbers.map((_, i) => `$n${i}: Int!`).join(', ')
  const aliases = numbers
    .map((_, i) => `    p${i}: pullRequest(number: $n${i}) { ...PRDetail }`)
    .join('\n')
  return `
query($owner: String!, $repo: String!, ${params}) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $repo) {
${aliases}
  }
}
${PR_DETAIL_FRAGMENT}`
}

/**
 * Fase 2: detalle por PR. Pagina lo que se haya truncado.
 *
 * El seguimiento de `files` no es opcional: la heurística de solapamiento
 * compara conjuntos de archivos, y un conjunto truncado produce silenciosamente
 * un "no se solapan" que es mentira.
 */
export async function fetchDetails(gh, prs, { log = console.error } = {}) {
  const byNumber = new Map()

  for (let i = 0; i < prs.length; i += DETAIL_BATCH) {
    const batch = prs.slice(i, i + DETAIL_BATCH)
    const numbers = batch.map((p) => p.number)
    const vars = { owner: gh.owner, repo: gh.repo }
    numbers.forEach((n, idx) => {
      vars[`n${idx}`] = n
    })

    const data = await gh.graphql(buildDetailQuery(numbers), vars, {
      label: `detalle PRs ${numbers.join(',')}`,
    })

    for (let idx = 0; idx < numbers.length; idx++) {
      const detail = data?.repository?.[`p${idx}`]
      if (detail) byNumber.set(numbers[idx], detail)
    }
  }

  const out = []
  for (const pr of prs) {
    const d = byNumber.get(pr.number)
    if (!d) {
      log(`[collect] sin detalle para #${pr.number}; se omite`)
      continue
    }

    let commitNodes = d.commits?.nodes ?? []
    if (d.commits?.pageInfo?.hasNextPage) {
      log(`[collect] #${pr.number} tiene ${d.commits.totalCount} commits; paginando`)
      const rest = await gh.graphqlPaginate(
        COMMITS_PAGE_QUERY,
        { owner: gh.owner, repo: gh.repo, number: pr.number },
        {
          path: 'repository.pullRequest.commits',
          label: `commits #${pr.number}`,
          startCursor: d.commits.pageInfo.endCursor,
        },
      )
      commitNodes = [...commitNodes, ...rest]
    }

    let fileNodes = d.files?.nodes ?? []
    if (d.files?.pageInfo?.hasNextPage) {
      log(`[collect] #${pr.number} toca ${d.files.totalCount} archivos; paginando`)
      const rest = await gh.graphqlPaginate(
        FILES_PAGE_QUERY,
        { owner: gh.owner, repo: gh.repo, number: pr.number },
        {
          path: 'repository.pullRequest.files',
          label: `files #${pr.number}`,
          startCursor: d.files.pageInfo.endCursor,
        },
      )
      fileNodes = [...fileNodes, ...rest]
    }

    let timelineNodes = d.timelineItems?.nodes ?? []
    if (d.timelineItems?.pageInfo?.hasNextPage) {
      const rest = await gh.graphqlPaginate(
        TIMELINE_PAGE_QUERY,
        { owner: gh.owner, repo: gh.repo, number: pr.number },
        {
          path: 'repository.pullRequest.timelineItems',
          label: `timeline #${pr.number}`,
          startCursor: d.timelineItems.pageInfo.endCursor,
        },
      )
      timelineNodes = [...timelineNodes, ...rest]
    }

    // Reviews e hilos también se paginan. CodeRabbit produce con soltura más
    // de 100 hilos en un PR grande, y truncarlos perdería eventos de feedback
    // en silencio — el mismo error que se evita arriba con `files`.
    let reviewNodes = d.reviews?.nodes ?? []
    if (d.reviews?.pageInfo?.hasNextPage) {
      log(`[collect] #${pr.number} tiene ${d.reviews.totalCount} reviews; paginando`)
      reviewNodes = [
        ...reviewNodes,
        ...(await gh.graphqlPaginate(
          REVIEWS_PAGE_QUERY,
          { owner: gh.owner, repo: gh.repo, number: pr.number },
          {
            path: 'repository.pullRequest.reviews',
            label: `reviews #${pr.number}`,
            startCursor: d.reviews.pageInfo.endCursor,
          },
        )),
      ]
    }

    let threadNodes = d.reviewThreads?.nodes ?? []
    if (d.reviewThreads?.pageInfo?.hasNextPage) {
      log(`[collect] #${pr.number} tiene ${d.reviewThreads.totalCount} hilos; paginando`)
      threadNodes = [
        ...threadNodes,
        ...(await gh.graphqlPaginate(
          REVIEW_THREADS_PAGE_QUERY,
          { owner: gh.owner, repo: gh.repo, number: pr.number },
          {
            path: 'repository.pullRequest.reviewThreads',
            label: `hilos #${pr.number}`,
            startCursor: d.reviewThreads.pageInfo.endCursor,
          },
        )),
      ]
    }

    out.push({
      ...pr,
      labels: (pr.labels?.nodes ?? []).map((l) => l.name),
      // detect() espera `message` completo: los trailers viven en el cuerpo.
      commits: commitNodes.map(({ commit }) => ({
        oid: commit.oid,
        headline: commit.messageHeadline,
        body: commit.messageBody,
        message: [commit.messageHeadline, commit.messageBody].filter(Boolean).join('\n\n'),
        authoredDate: commit.authoredDate,
        committedDate: commit.committedDate,
        authorLogin: commit.author?.user?.login ?? null,
        authorEmail: commit.author?.email ?? null,
      })),
      files: fileNodes.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        changeType: f.changeType,
      })),
      reviews: reviewNodes,
      reviewThreads: threadNodes,
      timeline: timelineNodes,
      closingIssues: d.closingIssuesReferences?.nodes ?? [],
    })
  }

  return out
}

/** Fase 3: commits de main desde `since`, para buscar reverts. */
export async function fetchMainHistory(gh, { since, branch = 'main', log = console.error }) {
  const sinceIso = since ? new Date(since).toISOString() : new Date(0).toISOString()
  log(`[collect] historial de ${branch} desde ${sinceIso}`)
  return gh.graphqlPaginate(
    HISTORY_QUERY,
    { owner: gh.owner, repo: gh.repo, since: sinceIso, branch: `refs/heads/${branch}` },
    { path: 'repository.ref.target.history', max: 2000, label: 'historial de main' },
  )
}

/**
 * Fase 4: estado del deployment de producción del merge commit.
 *
 * REST y no GraphQL porque los estados de deployment no se alcanzan bien desde
 * GraphQL. El filtro de environment se hace del lado del cliente a propósito:
 * el nombre real es `Production – atgq-erp` con GUION LARGO (U+2013), y meterlo
 * en un query string es una fuente garantizada de bugs de encoding.
 */
export async function fetchDeployStatus(gh, sha, { log = console.error } = {}) {
  if (!sha) return { state: 'missing', reason: 'sin merge commit' }
  try {
    const deployments = await gh.restPaginate(
      `/repos/${gh.owner}/${gh.repo}/deployments?sha=${sha}&per_page=100`,
      { max: 100 },
    )
    const prod = deployments.filter((d) => /^production/i.test(String(d.environment || '')))
    if (prod.length === 0) {
      const viaStatus = await fetchVercelCommitStatus(gh, sha)
      if (viaStatus) return viaStatus
      // Vercel saltea deploys de cambios solo-docs. Ausencia no es fallo.
      return { state: 'missing', reason: 'sin deployment de producción' }
    }
    prod.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const statuses = await gh.restPaginate(
      `/repos/${gh.owner}/${gh.repo}/deployments/${prod[0].id}/statuses?per_page=100`,
      { max: 100 },
    )
    if (!statuses.length) return { state: 'pending', reason: 'deployment sin estados' }
    statuses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    // El estado más nuevo TERMINAL, no el más nuevo a secas. GitHub le agrega
    // un estado `inactive` a un deployment viejo cuando otro lo reemplaza en el
    // mismo environment (auto_inactive); quedarse con el último dejaría el
    // deploy en `inactive`, que no es `success`, y `leadTimeToProd` en null.
    // Hoy Vercel no lo hace en este repo (verificado sobre el merge más viejo:
    // su último estado sigue siendo `success`), pero depender de que no empiece
    // a hacerlo sería apostar la métrica de portada a un detalle ajeno.
    const TERMINAL = new Set(['success', 'failure', 'error'])
    const terminal = statuses.find((s) => TERMINAL.has(s.state)) ?? statuses[0]
    return {
      state: terminal.state,
      environment: prod[0].environment,
      deploymentId: prod[0].id,
      at: terminal.created_at,
    }
  } catch (err) {
    log(`[collect] no pude leer deployments de ${sha?.slice(0, 8)}: ${err.message}`)
    return { state: 'unknown', reason: err.message }
  }
}

const VERCEL_STATUS_QUERY = `
query($owner: String!, $repo: String!, $oid: GitObjectID!) {
  rateLimit { cost remaining resetAt }
  repository(owner: $owner, name: $repo) {
    object(oid: $oid) {
      ... on Commit { status { contexts { context state createdAt } } }
    }
  }
}`

/** Respaldo: el status de commit de Vercel, cuando no hay Deployment. */
async function fetchVercelCommitStatus(gh, oid) {
  const data = await gh.graphql(
    VERCEL_STATUS_QUERY,
    { owner: gh.owner, repo: gh.repo, oid },
    { label: `status de commit ${oid.slice(0, 8)}` },
  )
  const contexts = getPath(data, 'repository.object.status.contexts') ?? []
  const vercel = contexts.find((c) => /^vercel\b/i.test(String(c.context || '')))
  if (!vercel) return null
  const map = { SUCCESS: 'success', FAILURE: 'failure', ERROR: 'error', PENDING: 'pending' }
  return {
    state: map[vercel.state] ?? String(vercel.state).toLowerCase(),
    via: 'commit-status',
    context: vercel.context,
    at: vercel.createdAt,
  }
}

/** Orquesta las cuatro fases. */
export async function collect(gh, { since, base = 'main', log = console.error } = {}) {
  const sinceDate = parseSince(since)
  const enumerated = await enumeratePRs(gh, { since: sinceDate, base, log })
  log(`[collect] ${enumerated.length} PRs mergeados sobre ${base}`)

  const detailed = await fetchDetails(gh, enumerated, { log })

  const history = await fetchMainHistory(gh, { since: sinceDate, branch: base, log })
  log(`[collect] ${history.length} commits en el historial de ${base}`)

  for (const pr of detailed) {
    pr.deploy = await fetchDeployStatus(gh, pr.mergeCommit?.oid, { log })
  }

  return { prs: detailed, history, since: sinceDate, base }
}

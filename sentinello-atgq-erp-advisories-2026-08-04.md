# Sentinello advisory export — /Users/diegoram/dev/atgq-erp

> Generated 2026-08-04T19:29:53.062Z · 41 findings · root: `/Users/diegoram/dev/atgq-erp` · 1 project · dep type: all (prod + dev)

## How to approach these fixes

You are helping a development team triage and fix the vulnerabilities listed at the bottom of this document. Treat this as a remediation work list, not a checklist to rubber-stamp. Work in a planning posture from the start: if your tooling has a read-only planning mode (Claude Code's plan mode, for example), enter it now and stay in it until the human has approved the triage below. Nothing in this document authorises you to edit a file before then.

## Audit existing overrides first — they may be the cause

Before triaging anything, read the existing `overrides` / `resolutions` / `pnpm.overrides` and any notes recorded beside them. An override written to fix an older advisory pins a version that no longer moves, so over time it silently becomes the reason a package is stale — including, quite possibly, the reason a finding in this list exists at all. For each existing override, report: what it forces and to which version, the original reason if one was recorded, whether its removal trigger has now been met, and whether it is currently *causing* any finding below. Say so explicitly when an override has become the problem rather than the fix, and treat correcting it as part of this work. Verify recorded removal triggers instead of trusting them — check the upstream version the note refers to and confirm it actually resolves the patched dependency, because a trigger written months ago is frequently no longer true.

## Triage every finding before you touch anything

Do NOT propose or apply a single version change until you have worked through all findings and presented a consolidated triage. Front-load the analysis so the human never has to ask "did you check X?". For each finding, determine and write down:

1. **What the advisory actually does.** Open the linked URL. Severity alone does not tell you whether your code path is exposed — a "critical" in a dev-only tool is very different from a "critical" in a request-handling library. Note the realistic exposure for *this* project.

2. **Direct or transitive?** Run `pnpm why <pkg>` / `npm ls <pkg>` / `yarn why <pkg>` at the repo root. Record the dependency path and the immediate parent.

3. **The parent-upgrade path — always check this; it is the preferred fix.** If the package is transitive, the safest fix is almost always to upgrade the *parent* so it pulls the patched child via a combination its author actually tested. For each transitive finding, report: the immediate parent, whether a newer parent version exists that resolves to the patched child, that parent's release maturity (stable / rc / beta / canary), and whether it is installable under the project's policy. Only if no viable parent upgrade exists do you move on to an override.

4. **Breaking changes between installed and target.** Read the CHANGELOG between the installed version and the fix version. Majors regularly break APIs; minors occasionally; patches rarely but can. Note what affects *this* codebase specifically — and go further than "this is a major, it may break": grep for the affected APIs, list the call sites by file, and sketch the code change each one needs. A version bump whose code impact you cannot describe is not a plan, it is a guess. If the upgrade needs no code change, say that explicitly too — it is the single most useful line the human can read.

5. **Install-policy / supply-chain check.** Before recommending a target version, confirm it satisfies the project's install policy. If the project pins a minimum release age (`.npmrc` `minimum-release-age`, or pnpm `minimumReleaseAge`), check the target version's publish date — if it is too new to install, say so up front and present options (wait N days vs. temporarily lower the threshold). Do not discover this only when the install fails.

6. **When the fix is too new for the install policy.** A minimum release age is a deliberate supply-chain control: it stops a freshly compromised release from being installed automatically. Do not quietly work around it — and do not silently drop the fix either. When the target version is younger than the threshold, report the advisory severity, the version's exact publish date and age, and the configured threshold, then let the human decide. For **critical or high** severity, actively recommend overriding and explain why the exposure outweighs the remaining wait; for moderate or low, default to waiting. If the human agrees, relax the gate for that **single command only** — e.g. `pnpm --config.minimumReleaseAge=0 add <pkg>@<exact-version>` — and **never** edit `.npmrc` or `pnpm-workspace.yaml` to achieve it, because a relaxed setting that gets committed disables the protection for everyone, permanently and invisibly. Whenever the gate is relaxed, pin every package you install in that command to an exact version: the relaxation applies to the whole resolution, not just the package you are fixing, so unrelated transitives can otherwise silently float to builds published hours ago. Afterwards, re-read the lockfile and confirm nothing moved except what you intended.

Present all of the above as one triage table covering every finding, with your recommended fix path per finding, and get the human's go-ahead before editing any manifest.

## Ranges are a claim; the lockfile is the fact

A caret or wildcard range tells you what *could* be installed, never what *is*. After every change, verify the fix in the lockfile itself — read the resolved version there, do not infer it from `package.json`. A parent's range routinely permits a patched child while the lockfile keeps the older resolved version, so the advisory survives an upgrade that looked correct. Re-running the scanner is the check that matters: if the finding is still present, the vulnerable copy is still installed.

Where you do control the specifier, prefer an exact version for direct dependencies — many projects enforce this already via `save-exact`. Treat `*`, `latest`, and bare `>=` as defects worth flagging on sight: they hand version selection to whatever was published most recently, which is precisely the window a compromised release needs. Never widen a range to obtain a fix, and never loosen a pin a human deliberately set — if a pinned direct dependency must move, move it to another exact version.

## Overrides are a last resort — and they require a written justification

`overrides` / `resolutions` / `pnpm.overrides` force a version the parent was never tested against. They are the last option, not the first. **You may not propose an override until you have output a justification block containing all four of:**

- **Parent-upgrade path investigated** — what you checked (step 3) and why it is not viable right now (e.g. fix only in a canary/rc, parent unmaintained, major bump would touch X / Y / Z).
- **Breaking-change + API-surface analysis** — the changes between the installed and forced version, AND what the immediate consumer actually calls from the package. A wide version jump can be perfectly safe when the consumer only touches a stable subset of the API — prove that, don't assume it.
- **Which last-resort condition is met** — one of: parent unmaintained with no alternative; bump is patch-level with a changelog showing only the security fix; package is dev-only and isolated from production code paths.
- **Removal trigger** — the concrete condition under which the override should be dropped (e.g. "remove when the parent ships a stable release that pulls the patched child"). Record this next to the override in the manifest.

No justification block, no override.

## Then fix incrementally and verify

- **Group findings by their fix before you sequence anything.** Several findings frequently collapse into one change — a single parent upgrade can clear four transitive advisories at once. Work out that mapping first and order the work by findings-cleared-per-change, so the cheapest high-yield fixes land first and whatever residue is left is genuinely irreducible rather than an artefact of fixing things one at a time.
- **Baseline first.** Run the test suite and a smoke build before any change; capture the output. After each fix, re-run both and diff — any new failure, warning, or behavioural change is yours to investigate, not to wave through because the audit went green.
- **One package (or one tight family) per commit.** After each fix, re-run Sentinello — the advisory should disappear from the current findings. If it does not, the upgrade did not actually replace the vulnerable version (usually a transitive resolution issue); dig deeper, do not move on.
- **Do not skip findings because they look hard.** Record the specific blocker (e.g. "needs major bump of X which touches Y, Z") so the team can plan it. Silent skips become next quarter's incident.

## The goal is zero — and what "zero" actually means

The target is zero remaining findings, and you should plan for zero rather than for "fewer". But zero only counts when you got there honestly: every finding either fixed by a real upgrade, or covered by an override carrying the full four-part justification above.

None of the following count as reaching zero, and you must not use them to close a finding:

- **Muting or dismissing a finding in Sentinello.** Muting is a human's decision about accepted risk, not a remediation step. Never mute on your own initiative, and never offer muting as a way to clear the list — if a finding genuinely warrants one, recommend it with reasoning and let the human do it.
- **Widening a range, unpinning a dependency, or loosening the lockfile** so the advisory stops matching.
- **Removing a package from the scan's scope**, excluding a workspace, or narrowing the dep-type filter.
- **Declaring a finding "not exploitable" without evidence.** Reachability is an argument you make from the code, not an assumption you start from.

Finish every pass with a residual table covering everything still open: the finding, why it is open (no upstream fix / needs a major bump touching X / parent unmaintained), what has to become true to close it, and the concrete trigger to revisit. A short residual table with real reasons is a good outcome. A silent zero is not.

The vulnerability list follows.

---

## Findings

### 1. `brace-expansion@5.0.4` — high

- **Advisory:** [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://nvd.nist.gov/vuln/detail/CVE-2026-13149) (`GHSA-3jxr-9vmj-r5cp`)
- **Fix:** upgrade to `5.0.7`
- **Vulnerable range:** `>=3.0.0 <5.0.7`
- **Dep type:** dev
- **Dependency path:** `node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion`
- **Project:** atgq-erp

### 2. `brace-expansion@1.1.16` — high

- **Advisory:** [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg) (`GHSA-mh99-v99m-4gvg`)
- **Fix:** upgrade to `1.1.17`
- **Vulnerable range:** `<1.1.17`
- **Dep type:** dev
- **Dependency path:** `. › eslint › @eslint/eslintrc › minimatch › brace-expansion`
- **Project:** atgq-erp

### 3. `brace-expansion@5.0.7` — high

- **Advisory:** [brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895) (`GHSA-rgw5-rvv9-x895`)
- **Fix:** upgrade to `5.0.9`
- **Vulnerable range:** `>=4.0.0 <5.0.9`
- **Dep type:** dev
- **Dependency path:** `. › eslint-config-next › @typescript-eslint/eslint-plugin › @typescript-eslint/parser › @typescript-eslint/typescript-estree › minimatch › brace-expansion`
- **Project:** atgq-erp

### 4. `flatted@3.4.1` — high

- **Advisory:** [Prototype Pollution via parse() in NodeJS flatted](https://nvd.nist.gov/vuln/detail/CVE-2026-33228) (`GHSA-rf6f-7fwh-wjgh`)
- **Fix:** upgrade to `3.4.2`
- **Vulnerable range:** `>=0 <3.4.2`
- **Dep type:** dev
- **Dependency path:** `node_modules/flatted`
- **Project:** atgq-erp

### 5. `glob@10.3.10` — high

- **Advisory:** [glob CLI: Command injection via -c/--cmd executes matches with shell:true](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) (`GHSA-5j98-mcp5-4vw2`)
- **Fix:** upgrade to `10.5.0`
- **Vulnerable range:** `>=10.2.0 <10.5.0`
- **Dep type:** dev
- **Dependency path:** `. › eslint-config-next › @next/eslint-plugin-next › glob`
- **Project:** atgq-erp

### 6. `js-yaml@4.1.1` — high

- **Advisory:** [js-yaml: YAML merge-key chains can force quadratic CPU consumption](https://nvd.nist.gov/vuln/detail/CVE-2026-59869) (`CVE-2026-59869`)
- **Fix:** upgrade to `4.3.0`
- **Vulnerable range:** `>=3.0.0 <3.15.0 || >=4.0.0 <4.3.0`
- **Dep type:** dev
- **Dependency path:** `node_modules/js-yaml`
- **Project:** atgq-erp

### 7. `next@14.2.35` — high

- **Advisory:** [Next.js has a Middleware / Proxy bypass in Pages Router applications using i18n](https://github.com/advisories/GHSA-36qx-fr4f-26g5) (`GHSA-36qx-fr4f-26g5`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=12.2.0 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 8. `next@14.2.35` — high

- **Advisory:** [Next.js: Server-Side Request Forgery in Server Actions on custom servers](https://github.com/advisories/GHSA-89xv-2m56-2m9x) (`GHSA-89xv-2m56-2m9x`)
- **Fix:** upgrade to `15.5.21`
- **Vulnerable range:** `>=14.1.1 <15.5.21`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 9. `next@14.2.35` — high

- **Advisory:** [Next.js Vulnerable to Denial of Service with Server Components](https://github.com/advisories/GHSA-8h8q-6873-q5fj) (`GHSA-8h8q-6873-q5fj`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=13.0.0 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 10. `next@14.2.35` — high

- **Advisory:** [Next.js vulnerable to server-side request forgery in applications using WebSocket upgrades](https://github.com/advisories/GHSA-c4j6-fc7j-m34r) (`GHSA-c4j6-fc7j-m34r`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=13.4.13 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 11. `next@14.2.35` — high

- **Advisory:** [Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components](https://github.com/advisories/GHSA-h25m-26qc-wcjf) (`GHSA-h25m-26qc-wcjf`)
- **Fix:** upgrade to `15.0.8`
- **Vulnerable range:** `>=13.0.0 <15.0.8`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 12. `next@14.2.35` — high

- **Advisory:** [Next.js: Denial of Service in App Router using Server Actions](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) (`GHSA-m99w-x7hq-7vfj`)
- **Fix:** upgrade to `15.5.21`
- **Vulnerable range:** `>=13.0.0 <15.5.21`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 13. `next@14.2.35` — high

- **Advisory:** [Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) (`GHSA-p9j2-gv94-2wf4`)
- **Fix:** upgrade to `15.5.21`
- **Vulnerable range:** `>=12.0.0 <15.5.21`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 14. `next@14.2.35` — high

- **Advisory:** [Next.js has a Denial of Service with Server Components](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) (`GHSA-q4gf-8mx6-v5v3`)
- **Fix:** upgrade to `15.5.15`
- **Vulnerable range:** `>=13.0.0 <15.5.15`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 15. `picomatch@4.0.3` — high

- **Advisory:** [Picomatch has a ReDoS vulnerability via extglob quantifiers](https://nvd.nist.gov/vuln/detail/CVE-2026-33671) (`GHSA-c2c7-rcm5-vvqj`)
- **Fix:** upgrade to `4.0.4`
- **Vulnerable range:** `>=4.0.0 <4.0.4`
- **Dep type:** prod
- **Dependency path:** `node_modules/tinyglobby/node_modules/picomatch`
- **Project:** atgq-erp

### 16. `postcss@8.4.31` — high

- **Advisory:** [PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q) (`GHSA-6g55-p6wh-862q`)
- **Fix:** upgrade to `8.5.12`
- **Vulnerable range:** `<=8.5.11`
- **Dep type:** dev
- **Dependency path:** `. › next › postcss`
- **Project:** atgq-erp

### 17. `postcss@8.4.31` — high

- **Advisory:** [PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849) (`GHSA-r28c-9q8g-f849`)
- **Fix:** upgrade to `8.5.18`
- **Vulnerable range:** `<=8.5.17`
- **Dep type:** dev
- **Dependency path:** `. › next › postcss`
- **Project:** atgq-erp

### 18. `ws@8.19.0` — high

- **Advisory:** [ws: Memory exhaustion DoS from tiny fragments and data chunks](https://nvd.nist.gov/vuln/detail/CVE-2026-48779) (`CVE-2026-48779`)
- **Fix:** upgrade to `8.21.0`
- **Vulnerable range:** `>=1.1.0 <5.2.5 || >=6.0.0 <6.2.4 || >=7.0.0 <7.5.11 || >=8.0.0 <8.21.0`
- **Dep type:** prod
- **Dependency path:** `node_modules/ws`
- **Project:** atgq-erp

### 19. `xlsx@0.18.5` — high

- **Advisory:** [Prototype Pollution in sheetJS](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (`GHSA-4r6h-8v6p-xvw6`)
- **Fix:** upgrade to `0.19.3`
- **Vulnerable range:** `<0.19.3`
- **Dep type:** prod
- **Dependency path:** `. › xlsx`
- **Project:** atgq-erp

### 20. `xlsx@0.18.5` — high

- **Advisory:** [SheetJS Regular Expression Denial of Service (ReDoS)](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) (`GHSA-5pgg-2g8v-p4x9`)
- **Fix:** upgrade to `0.20.2`
- **Vulnerable range:** `<0.20.2`
- **Dep type:** prod
- **Dependency path:** `. › xlsx`
- **Project:** atgq-erp

### 21. `brace-expansion@5.0.4` — moderate

- **Advisory:** [brace-expansion: Zero-step sequence causes process hang and memory exhaustion](https://nvd.nist.gov/vuln/detail/CVE-2026-33750) (`GHSA-f886-m6hf-6m8v`)
- **Fix:** upgrade to `5.0.5`
- **Vulnerable range:** `>=4.0.0 <5.0.5`
- **Dep type:** dev
- **Dependency path:** `node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion`
- **Project:** atgq-erp

### 22. `brace-expansion@5.0.4` — moderate

- **Advisory:** [brace-expansion: Large numeric range defeats documented `max` DoS protection](https://nvd.nist.gov/vuln/detail/CVE-2026-45149) (`GHSA-jxxr-4gwj-5jf2`)
- **Fix:** upgrade to `5.0.6`
- **Vulnerable range:** `>=5.0.0 <5.0.6`
- **Dep type:** dev
- **Dependency path:** `node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion`
- **Project:** atgq-erp

### 23. `eslint@8.57.1` — moderate

- **Advisory:** [Withdrawn Advisory: eslint has a Stack Overflow when serializing objects with circular references](https://nvd.nist.gov/vuln/detail/CVE-2025-50537) (`GHSA-p5wg-g6qr-c7cg`)
- **Fix:** upgrade to `9.26.0`
- **Vulnerable range:** `>=0 <9.26.0`
- **Dep type:** dev
- **Dependency path:** `node_modules/eslint`
- **Project:** atgq-erp

### 24. `js-yaml@4.1.1` — moderate

- **Advisory:** [JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases](https://nvd.nist.gov/vuln/detail/CVE-2026-53550) (`GHSA-h67p-54hq-rp68`)
- **Fix:** upgrade to `4.2.0`
- **Vulnerable range:** `>=4.0.0 <4.2.0`
- **Dep type:** dev
- **Dependency path:** `node_modules/js-yaml`
- **Project:** atgq-erp

### 25. `next@14.2.35` — moderate

- **Advisory:** [Next.js: Unbounded next/image disk cache growth can exhaust storage](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) (`GHSA-3x4c-7xq6-9pq8`)
- **Fix:** upgrade to `15.5.14`
- **Vulnerable range:** `>=10.0.0 <15.5.14`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 26. `next@14.2.35` — moderate

- **Advisory:** [Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences](https://github.com/advisories/GHSA-4633-3j49-mh5q) (`GHSA-4633-3j49-mh5q`)
- **Fix:** upgrade to `15.5.21`
- **Vulnerable range:** `>=13.0.0 <15.5.21`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 27. `next@14.2.35` — moderate

- **Advisory:** [Next.js: Unbounded Server Action payload in Edge runtime](https://github.com/advisories/GHSA-4c39-4ccg-62r3) (`GHSA-4c39-4ccg-62r3`)
- **Fix:** upgrade to `15.5.21`
- **Vulnerable range:** `>=13.0.0 <15.5.21`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 28. `next@14.2.35` — moderate

- **Advisory:** [Next.js: Cache confusion of response bodies for requests with bodies](https://github.com/advisories/GHSA-68g3-v927-f742) (`GHSA-68g3-v927-f742`)
- **Fix:** upgrade to `15.5.21`
- **Vulnerable range:** `>=13.0.0 <15.5.21`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 29. `next@14.2.35` — moderate

- **Advisory:** [Next.js: Unauthenticated disclosure of internal Server Function endpoints](https://github.com/advisories/GHSA-955p-x3mx-jcvp) (`GHSA-955p-x3mx-jcvp`)
- **Fix:** upgrade to `15.5.21`
- **Vulnerable range:** `>=13.0.0 <15.5.21`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 30. `next@14.2.35` — moderate

- **Advisory:** [Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns configuration](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) (`GHSA-9g9p-9gw9-jx7f`)
- **Fix:** upgrade to `15.5.10`
- **Vulnerable range:** `>=10.0.0 <15.5.10`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 31. `next@14.2.35` — moderate

- **Advisory:** [Next.js vulnerable to cross-site scripting in App Router applications using CSP nonces](https://github.com/advisories/GHSA-ffhc-5mcf-pf4q) (`GHSA-ffhc-5mcf-pf4q`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=13.4.0 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 32. `next@14.2.35` — moderate

- **Advisory:** [Next.js: HTTP request smuggling in rewrites](https://github.com/advisories/GHSA-ggv3-7p47-pfv8) (`GHSA-ggv3-7p47-pfv8`)
- **Fix:** upgrade to `15.5.13`
- **Vulnerable range:** `>=9.5.0 <15.5.13`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 33. `next@14.2.35` — moderate

- **Advisory:** [Next.js has cross-site scripting in beforeInteractive scripts with untrusted input](https://github.com/advisories/GHSA-gx5p-jg67-6x7h) (`GHSA-gx5p-jg67-6x7h`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=13.0.0 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 34. `next@14.2.35` — moderate

- **Advisory:** [Next.js has a Denial of Service in the Image Optimization API](https://github.com/advisories/GHSA-h64f-5h5j-jqjh) (`GHSA-h64f-5h5j-jqjh`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=10.0.0 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 35. `next@14.2.35` — moderate

- **Advisory:** [Next.js vulnerable to cache poisoning in React Server Component responses](https://github.com/advisories/GHSA-wfc6-r584-vfw7) (`GHSA-wfc6-r584-vfw7`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=14.2.0 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 36. `picomatch@4.0.3` — moderate

- **Advisory:** [Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching](https://nvd.nist.gov/vuln/detail/CVE-2026-33672) (`GHSA-3v7f-55p6-f55p`)
- **Fix:** upgrade to `4.0.4`
- **Vulnerable range:** `>=4.0.0 <4.0.4`
- **Dep type:** prod
- **Dependency path:** `node_modules/tinyglobby/node_modules/picomatch`
- **Project:** atgq-erp

### 37. `postcss@8.4.31` — moderate

- **Advisory:** [PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) (`GHSA-fxqj-rqcc-2cmp`)
- **Fix:** upgrade to `8.5.23`
- **Vulnerable range:** `<=8.5.22`
- **Dep type:** dev
- **Dependency path:** `. › next › postcss`
- **Project:** atgq-erp

### 38. `postcss@8.4.31` — moderate

- **Advisory:** [PostCSS has XSS via Unescaped </style> in its CSS Stringify Output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) (`GHSA-qx2v-qp2m-jg93`)
- **Fix:** upgrade to `8.5.10`
- **Vulnerable range:** `<8.5.10`
- **Dep type:** dev
- **Dependency path:** `. › next › postcss`
- **Project:** atgq-erp

### 39. `ws@8.19.0` — moderate

- **Advisory:** [ws: Uninitialized memory disclosure](https://nvd.nist.gov/vuln/detail/CVE-2026-45736) (`GHSA-58qx-3vcg-4xpx`)
- **Fix:** upgrade to `8.20.1`
- **Vulnerable range:** `>=8.0.0 <8.20.1`
- **Dep type:** prod
- **Dependency path:** `node_modules/ws`
- **Project:** atgq-erp

### 40. `next@14.2.35` — low

- **Advisory:** [Next.js's Middleware / Proxy redirects can be cache-poisoned](https://github.com/advisories/GHSA-3g8h-86w9-wvmq) (`GHSA-3g8h-86w9-wvmq`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=12.2.0 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

### 41. `next@14.2.35` — low

- **Advisory:** [Next.js vulnerable to cache poisoning via collisions in React Server Component cache-busting](https://github.com/advisories/GHSA-vfv6-92ff-j949) (`GHSA-vfv6-92ff-j949`)
- **Fix:** upgrade to `15.5.16`
- **Vulnerable range:** `>=13.4.6 <15.5.16`
- **Dep type:** prod
- **Dependency path:** `. › next`
- **Project:** atgq-erp

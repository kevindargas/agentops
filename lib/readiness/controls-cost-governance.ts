import type { ControlDef, FailureMode } from "./types"

/**
 * Wave-2 controls (cost-governance). Composed into `defaultControlSet` by
 * `controls.ts`; failure modes are merged by `library.ts`. Keep ids stable.
 */

const agentic = ["agent", "multi-agent"] as const

export const controls: ControlDef[] = [
  // ---- Cost & performance ---------------------------------------------------
  {
    id: "CST-09",
    domain: "cost-performance",
    title: "Durable execution and recovery",
    what: "Long-running agent runs are checkpointed and resumable: every side-effecting action is recorded in an action ledger before it executes, runs have explicit states (running, suspended, cancelled, completed) and an interrupted run resumes from its last checkpoint instead of starting over.",
    why: "A crashed orchestrator that restarts blindly re-sends the email, re-creates the ticket and re-charges the card. Without replay semantics and a ledger, recovery is either manual archaeology or duplicated side effects.",
    how: [
      "Run the agent loop on a durable workflow engine (Temporal-style workflows and activities, or a checkpointed agent graph) so model calls, tool calls and waits are persisted steps.",
      "Write an action-ledger entry with idempotency key, intent and result for every write tool call; the executor checks the ledger before re-running a step on replay.",
      "Model run states explicitly (running, suspended awaiting approval, cancelled, completed) and propagate cancellation to in-flight tool calls and sub-agents.",
      "Give every step a timeout owner: either the engine retries it or a human is paged; partial completion is surfaced to the user, not hidden.",
      "Run a recovery test in CI or staging: kill the worker mid-run and assert the run resumes with no duplicated side effect.",
    ],
    done: "Killing a worker during a multi-step staging run leaves the run in suspended state; on restart it resumes from the last checkpoint and the action ledger shows every write exactly once.",
    risk: 4,
    effort: "high",
    requiredAt: "pilot",
    applicability: { systemTypes: [...agentic] },
    frameworks: {
      owasp: ["LLM06"],
      nist: ["MEASURE 2.7", "MANAGE 2.3"],
      euAiAct: ["Art. 15"],
      otel: ["gen_ai.operation.name=invoke_agent", "gen_ai.tool.call.id"],
    },
    tools: ["temporal", "langfuse", "langsmith", "datadog"],
    metrics: ["resume-success-rate", "duplicate-effect-rate"],
    cadence: {
      every: "quarterly",
      label: "Run the kill-and-resume recovery test",
    },
    learnMore: [
      {
        label: "Temporal: durable execution concepts",
        href: "https://docs.temporal.io/evaluate/understanding-temporal",
      },
    ],
  },
  {
    id: "CST-10",
    domain: "cost-performance",
    title: "User-centered SLOs with error budgets",
    what: "Building on the latency SLOs in CST-03, each agent publishes SLIs defined from the user's point of view (availability, latency, valid output, task completion and safe completion) each with an explicit good-event definition, an error budget and multi-window burn-rate alerts routed to a named owner with a runbook.",
    why: "A system that answers in 800 ms with a wrong or unauthorised action is not reliable, yet a latency-only SLO calls it healthy. Error budgets turn 'is it good enough' into a number the team can spend or defend, and burn-rate alerts replace threshold noise with pages that mean something.",
    how: [
      "Write a good-event definition per SLI (e.g. 'response delivered, passed output validation, no guardrail block, within 5 s') and derive the SLI as good events over valid events.",
      "Split fast operational SLIs (availability, p95 latency, error rate) from delayed quality SLIs (task completion, judge score, safety violations) and state the measurement delay of each.",
      "Set a target and 28-day error budget per SLI; publish remaining budget on the agent's dashboard.",
      "Alert on multi-window burn rate (e.g. 2% of budget in 1 h and 5 min) rather than fixed thresholds; add cost-anomaly and security alert classes with their own severity.",
      "Deduplicate and route every alert to an owning team with a linked runbook; alerts without an owner or runbook are deleted.",
    ],
    done: "Every production agent shows four or more SLIs with written good-event definitions and remaining error budget; firing a synthetic quality drop in staging pages the on-call within the fast window with a runbook link.",
    risk: 4,
    effort: "medium",
    requiredAt: "production",
    gate: true,
    frameworks: {
      nist: ["MEASURE 2.4", "MANAGE 4.1"],
      euAiAct: ["Art. 15", "Art. 72"],
      otel: [
        "gen_ai.client.operation.duration",
        "gen_ai.response.finish_reasons",
      ],
    },
    tools: ["grafana", "datadog", "langfuse", "openlit", "otel-collector"],
    metrics: ["error-budget-remaining", "p95-latency", "task-completion-rate"],
    snippets: ["alert-rules"],
    cadence: {
      every: "monthly",
      label: "Review SLO targets, budget burn and alert noise",
    },
    learnMore: [
      {
        label: "Google SRE Workbook: Alerting on SLOs",
        href: "https://sre.google/workbook/alerting-on-slos/",
      },
    ],
  },
  {
    id: "CST-11",
    domain: "cost-performance",
    title: "Load, chaos and disaster-recovery drills",
    what: "The system is exercised under burst and long-context load, with injected faults (provider outage, throttling, slow or failing tools, truncated streams, region loss) and a restore-from-backup drill, against written RTO and RPO targets.",
    why: "Production failure is rarely a clean request at nominal traffic. The first time a provider returns 429s for twenty minutes or a stream dies at token 400 should be a drill, not a Friday evening.",
    how: [
      "Run load and soak tests with realistic prompt-length distribution and streaming-aware checks (TTFT, tokens per second, stream completion), not just HTTP status codes.",
      "Inject faults in staging: primary provider down, rate limiting, a tool that hangs or returns garbage, a partial stream, loss of a vector-index region; assert fallbacks, timeouts and user-facing messages behave as designed.",
      "Set RTO and RPO per stateful component (indexes, memory stores, action ledger, prompt registry) and verify them by restoring from backup into a clean environment.",
      "Hold a game day before launch and on a cadence; track every finding to a fix and re-run the failing scenario.",
    ],
    done: "The last drill report lists each injected fault with observed behaviour, RTO/RPO achieved versus target and open findings; a restore of the retrieval index from backup completed within RTO in the last six months.",
    risk: 4,
    effort: "high",
    requiredAt: "production",
    frameworks: {
      owasp: ["LLM10"],
      nist: ["MEASURE 2.7", "MANAGE 2.3"],
      euAiAct: ["Art. 15"],
    },
    tools: ["k6", "chaos-toolkit", "grafana", "datadog", "litellm"],
    metrics: ["drill-pass-rate", "fallback-rate", "stream-disconnect-rate"],
    cadence: { every: "semiannual", label: "Run a chaos and DR game day" },
    learnMore: [
      {
        label: "Principles of Chaos Engineering",
        href: "https://principlesofchaos.org/",
      },
    ],
  },
  {
    id: "CST-12",
    domain: "cost-performance",
    title: "Cost per successful task and unit economics",
    what: "Cost is attributed to the complete task, not the request: model tokens plus retrieval, tool and API calls, GPU and storage, observability, human review and support rework, divided by successful outcomes and reported as margin by feature and tenant.",
    why: "Cost per request is easy to lower and easy to game. A cheaper model that resolves fewer tickets or needs more human review raises the cost of every success while the dashboard shows savings.",
    how: [
      "Tag every model, retrieval and tool span with task id, feature and tenant so costs join to outcomes in the warehouse.",
      "Add non-model costs per task: tool and search API fees, vector-store and GPU time, reviewer minutes from the review queue, support tickets caused by the agent.",
      "Compute cost per successful task (total attributed cost / tasks marked successful) alongside cost per request; publish both with trend.",
      "Report gross margin per feature and per tenant against price; flag any segment where cost per success rose quarter over quarter.",
    ],
    done: "A dashboard shows cost per successful task per agent, feature and tenant for the last 90 days including review and tool costs; the finance owner can reconcile it to the provider invoices within 5%.",
    risk: 3,
    effort: "medium",
    requiredAt: "pilot",
    frameworks: {
      owasp: ["LLM10"],
      nist: ["MANAGE 2.2", "MEASURE 2.4"],
      otel: ["gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens"],
    },
    tools: ["helicone", "litellm", "langfuse", "dbt", "grafana"],
    metrics: [
      "cost-per-successful-task",
      "cost-per-request",
      "review-minutes-per-item",
    ],
    cadence: {
      every: "monthly",
      label: "Review unit economics by feature and tenant",
    },
    learnMore: [
      {
        label: "FinOps Foundation: Unit economics",
        href: "https://www.finops.org/framework/capabilities/unit-economics/",
      },
    ],
  },

  // ---- Governance -----------------------------------------------------------
  {
    id: "GOV-11",
    domain: "governance",
    title: "Product and outcome KPIs",
    what: "Each agent has named business KPIs (resolution or deflection rate, conversion, time saved, errors avoided, revenue or cost impact) measured against a holdout or control group with confidence intervals, owned by a product lead and reviewed on a schedule.",
    why: "Eval scores can climb while customers churn. If the only numbers are model metrics, nobody can say whether the agent is paying for itself or quietly degrading the outcome it was built to improve.",
    how: [
      "Pick two to four outcome KPIs per agent with a written definition and the downstream system of record (CRM, ticketing, billing) they are read from.",
      "Join product analytics and outcome events to AI traces and experiment exposure by session id so KPIs can be sliced by model, prompt version and cohort.",
      "Keep a holdout or control arm (no agent, or previous version) and report lift with confidence intervals, not raw deltas.",
      "Assign a KPI owner and review results monthly; a release that improves eval scores but not KPIs is a question, not a win.",
    ],
    done: "The agent's KPI page shows lift versus control with confidence intervals for each KPI over the last quarter, the named owner, and the date of the last review.",
    risk: 3,
    effort: "medium",
    requiredAt: "pilot",
    frameworks: {
      nist: ["MAP 1.1", "MANAGE 2.2", "MEASURE 4.2"],
      iso42001: ["A.9", "A.6"],
    },
    tools: ["langfuse", "braintrust", "langsmith", "dbt"],
    metrics: ["outcome-kpi-lift", "task-outcome-rate"],
    cadence: { every: "monthly", label: "Review outcome KPIs against control" },
    learnMore: [
      {
        label: "NIST AI RMF: MANAGE function",
        href: "https://airc.nist.gov/airmf-resources/playbook/manage/",
      },
    ],
  },
  {
    id: "GOV-12",
    domain: "governance",
    title: "Tested rollback and kill-switch drills",
    what: "Rollback is a versioned bundle (prompt, model, parameters, index, memory schema, tool set) whose compatibility is checked, plus a write-disable switch, tool credential revocation and cache invalidation: and every one of these is exercised in a recorded drill. SAF-11 provides the loop bounds and pause flag; this control proves they and the full rollback work.",
    why: "Rolling back the model does not undo the index rebuild, the memory entries the new prompt wrote or the webhooks already fired. A kill switch nobody has pulled is a hypothesis.",
    how: [
      "Release prompt, model, parameters, index version, memory schema and tool manifest as one versioned bundle; store compatibility constraints so a rollback cannot pair a prompt with an index it was never tested against.",
      "Implement per-capability switches: fleet pause, write-disable (read-only mode), per-tool disable and credential revocation for the agent's tool identities.",
      "Script cache and memory invalidation as part of rollback so stale outputs or poisoned memories do not survive the switch.",
      "Run a rollback drill in production-like conditions on a cadence: measure time to restore, confirm external-state reconciliation, record the result and fix what failed.",
    ],
    done: "The last drill record is under 90 days old and shows the rollback bundle restored within the target time, the write-disable switch stopping tool writes within 30 seconds, and revoked credentials failing closed.",
    risk: 5,
    effort: "medium",
    requiredAt: "pilot",
    gate: true,
    frameworks: {
      owasp: ["LLM06"],
      nist: ["MANAGE 2.4", "GOVERN 1.7"],
      euAiAct: ["Art. 14"],
      iso42001: ["A.6"],
    },
    tools: ["litellm", "portkey", "vault", "temporal", "langfuse"],
    metrics: ["rollback-drill-age", "config-parity-rate"],
    cadence: {
      every: "quarterly",
      label: "Run a rollback and kill-switch drill",
    },
    learnMore: [
      {
        label: "Google SRE Book: Release engineering",
        href: "https://sre.google/sre-book/release-engineering/",
      },
    ],
  },
  {
    id: "GOV-13",
    domain: "governance",
    title: "Decision records with tamper evidence",
    what: "Every consequential agent action produces one decision record holding actor and delegating user, authorisation context, prompt, model and policy versions, intent and result, approval (if any) and timestamps, stored append-only with a hash chain or signed manifests, with its own access log and retention per policy. GOV-05 covers configuration changes; this covers what the system did.",
    why: "An investigation needs to show what happened, who approved it and under which policy, and that nobody edited the record afterwards. Traces alone are mutable, sampled and scattered across tools.",
    how: [
      "Define which actions are consequential (writes, payments, messages sent, access granted) and emit a decision record for each from the tool executor, not from the model.",
      "Include actor and on-behalf-of user, scopes or token used, prompt/model/policy version ids, tool input and output summary, approver and approval time.",
      "Write records to append-only storage with a hash chain or periodically signed manifests (Sigstore-style) so tampering is detectable; verify the chain on a schedule.",
      "Log every read of the decision store and apply the retention schedule from the data policy; expiry is a logged action too.",
    ],
    done: "Pick any consequential action from last month: a single record reconstructs actor, authorisation, versions, approval and result; the chain verification job for the period passes and the record's access log is available.",
    risk: 4,
    effort: "medium",
    requiredAt: "pilot",
    applicability: { minAutonomy: "supervised", otherwise: "reduced" },
    frameworks: {
      owasp: ["LLM06"],
      nist: ["GOVERN 1.5", "MEASURE 2.9"],
      euAiAct: ["Art. 12"],
      iso42001: ["A.8"],
    },
    tools: ["sigstore", "vault", "langfuse", "datadog", "opa"],
    metrics: ["decision-record-completeness", "lineage-completeness"],
    cadence: {
      every: "quarterly",
      label: "Verify the hash chain and retention",
    },
    learnMore: [
      {
        label: "EU AI Act Art. 12: Record-keeping",
        href: "https://artificialintelligenceact.eu/article/12/",
      },
    ],
  },
  {
    id: "GOV-14",
    domain: "governance",
    title: "Compliance obligations as testable controls",
    what: "Legal, contractual and organisational obligations for each jurisdiction and use case are assessed, translated into controls with a named owner, an evidence source and a collection cadence, and reviewed periodically: aligned to ISO/IEC 42001 and 23894 where the organisation certifies.",
    why: "A policy PDF is not compliance. Auditors, regulators and enterprise customers ask for evidence that each obligation is met today, and the EU AI Act turns that into a quality-management duty with deadlines.",
    how: [
      "Run a jurisdiction and use-case assessment: which laws (EU AI Act risk class, GDPR, HIPAA, PCI DSS), contracts and internal policies apply, and what records each requires.",
      "Complete the privacy assessment (DPIA) and fundamental-rights impact assessment where required; link them to the system card.",
      "Map each obligation to one or more readiness controls, assign an owner and define the evidence artefact (export, log, report) and how often it is collected.",
      "Automate evidence collection where possible and track freshness; review the obligation register on a schedule and after every material change to the system.",
    ],
    done: "The obligation register lists every applicable obligation with owner, mapped control, evidence location and last-collected date; no evidence item is older than its cadence and the register was reviewed in the last six months.",
    risk: 4,
    effort: "high",
    requiredAt: "pilot",
    applicability: {
      regulatory: [
        "eu-ai-act",
        "gdpr",
        "hipaa",
        "pci-dss",
        "soc2",
        "iso-42001",
      ],
      otherwise: "reduced",
    },
    frameworks: {
      nist: ["GOVERN 1.2", "GOVERN 1.3", "MEASURE 2.10"],
      euAiAct: ["Art. 9", "Art. 17"],
      iso42001: ["A.2", "A.5"],
    },
    tools: ["opa", "vault", "trivy"],
    metrics: ["evidence-freshness", "threat-model-age"],
    cadence: {
      every: "semiannual",
      label: "Review the obligation register and evidence",
    },
    learnMore: [
      {
        label: "ISO/IEC 42001:2023: AI management systems",
        href: "https://www.iso.org/standard/42001",
      },
    ],
  },
  {
    id: "GOV-15",
    domain: "governance",
    title: "System inventory with end-of-life dates",
    what: "A single inventory records every component involved in an AI decision (models, providers, adapters, prompts, embeddings, indexes, datasets, tools, MCP servers, policies, regions) with owner, version and end-of-life date, plus a dependency graph between them. SAF-10 vets the supply chain and DRF-05 tracks model deprecations; this is the complete picture they both read from.",
    why: "An unchanged model behaves differently after a prompt, embedding, index or provider update. If nobody can list what an agent depends on, nobody can say what changed, what is about to expire or who to call.",
    how: [
      "Build or designate one inventory (model registry plus service catalog) and register every component type with an owner, version, source and EOL or review date.",
      "Record dependencies as edges (agent → prompt version → model; index → embedding model → dataset) so impact analysis is a graph query.",
      "Feed the inventory automatically from the gateway, prompt registry and MCP server registry; a component that is in production but not in the inventory is a finding.",
      "Alert owners 90 days before any EOL date and track components past EOL as risks until replaced.",
    ],
    done: "For any production agent the inventory returns its full dependency graph with owners and EOL dates in one query; the EOL report shows zero components past end-of-life without an accepted exception.",
    risk: 3,
    effort: "medium",
    requiredAt: "pilot",
    frameworks: {
      owasp: ["LLM03"],
      nist: ["GOVERN 1.6", "MAP 4.1"],
      euAiAct: ["Art. 11"],
      iso42001: ["A.4", "A.10"],
    },
    tools: ["mlflow", "langfuse", "litellm", "portkey", "trivy"],
    metrics: ["eol-components", "tool-definition-changes"],
    cadence: {
      every: "quarterly",
      label: "Reconcile the inventory with production",
    },
    learnMore: [
      {
        label: "NIST AI RMF Playbook: GOVERN 1.6 (AI inventory)",
        href: "https://airc.nist.gov/airmf-resources/playbook/govern/",
      },
    ],
  },
]

export const failureModes: FailureMode[] = [
  {
    id: "fm-partial-rollback",
    title: "Rollback restores the prompt but not the index it needs",
    summary:
      "A bad release is rolled back by re-pointing the production label at the previous prompt. The new release had also rebuilt the vector index with a different embedding model and migrated the memory schema; the old prompt now retrieves garbage and the kill switch does not cover the writes already sent downstream.",
    domain: "governance",
    controls: ["GOV-12", "GOV-15", "DRF-05", "SAF-11", "GOV-03"],
  },
  {
    id: "fm-untested-kill-switch",
    title: "Kill switch nobody has ever pulled",
    summary:
      "The runbook names a fleet pause flag. During the first real incident it turns out the flag is read only at process start, the credential revocation needs a vendor ticket and the on-call does not have the permission. Containment takes three hours instead of thirty seconds.",
    domain: "governance",
    controls: ["GOV-12", "SAF-11", "GOV-07", "CST-11"],
  },
  {
    id: "fm-cost-per-success-doubled",
    title: "Cost per request fell while cost per resolved ticket doubled",
    summary:
      "A cheaper model cuts token spend by 40% and the FinOps dashboard celebrates. Resolution rate drops, each conversation runs longer, more items land in the human review queue and customers reopen tickets; the all-in cost of a resolved ticket is twice what it was.",
    domain: "cost-performance",
    controls: ["CST-12", "GOV-11", "CST-10", "QUA-01", "CST-01"],
  },
]

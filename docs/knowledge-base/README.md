# Knowledge base

Reference material for people who operate or extend AgentOps. Feature-by-feature guides live in [docs/features](../README.md#feature-guides); this section covers vocabulary, concepts, questions and procedures that cut across pages.

## Reference

- [Glossary](glossary.md): every domain term and id prefix, grounded in `lib/types.ts` and `lib/data/*`.
- [FAQ](faq.md): questions a new operator asks in the first week, answered from the code.
- [Troubleshooting](troubleshooting.md): build, dev server, hydration, network and test failures.

## Concepts

- [Traces and spans](concepts/traces-and-spans.md)
- [Drift and baselines](concepts/drift-and-baselines.md)
- [Evaluation and release gates](concepts/evaluation-and-release-gates.md)
- [Guardrails and policies](concepts/guardrails-and-policies.md)
- [Deployment strategies](concepts/deployment-strategies.md)
- [Routing and providers](concepts/routing-and-providers.md)
- [Model parameters](concepts/model-parameters.md)
- [Readiness scoring](concepts/readiness-scoring.md)

## Runbooks

Short, step-by-step procedures. Each one says when to use it, which page and button to use, what to record and who to tell.

- [Triage a flagged trace](runbooks/triage-a-flagged-trace.md)
- [Handle a drift signal](runbooks/handle-a-drift-signal.md)
- [Promote an experiment](runbooks/promote-an-experiment.md)
- [Roll back a release](runbooks/roll-back-a-release.md)
- [Rotate an API key](runbooks/rotate-an-api-key.md)
- [Respond to a budget breach](runbooks/respond-to-a-budget-breach.md)
- [Onboard a new agent](runbooks/onboard-a-new-agent.md)
- [Run a readiness assessment](runbooks/run-a-readiness-assessment.md)

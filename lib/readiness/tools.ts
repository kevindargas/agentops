import type { ToolDef } from "./types"

/** Tool matrix. `domains` lists where the tool is a credible primary option. */
export const tools: ToolDef[] = [
  {
    id: "langfuse",
    name: "Langfuse",
    kind: "both",
    url: "https://langfuse.com",
    summary:
      "Tracing, prompt registry, datasets, evals and annotation queues. OSS core, managed cloud.",
    domains: [
      "visibility",
      "quality",
      "drift",
      "cost-performance",
      "governance",
    ],
  },
  {
    id: "mlflow",
    name: "MLflow",
    kind: "open-source",
    url: "https://mlflow.org",
    summary:
      "Experiment tracking, model registry, prompt registry and GenAI tracing/evals.",
    domains: ["quality", "drift", "governance", "visibility"],
  },
  {
    id: "phoenix",
    name: "Arize Phoenix",
    kind: "open-source",
    url: "https://phoenix.arize.com",
    summary:
      "OTel-native tracing, retrieval analysis, embedding drift and LLM evals.",
    domains: ["visibility", "quality", "drift", "safety"],
  },
  {
    id: "arize",
    name: "Arize AX",
    kind: "managed",
    url: "https://arize.com",
    summary:
      "Managed observability with drift, performance tracing and online evals at scale.",
    domains: ["drift", "visibility", "quality"],
  },
  {
    id: "datadog",
    name: "Datadog LLM Observability",
    kind: "managed",
    url: "https://www.datadoghq.com/product/llm-observability/",
    summary:
      "LLM traces alongside APM, out-of-the-box quality and security checks, alerting.",
    domains: ["visibility", "cost-performance", "drift", "safety"],
  },
  {
    id: "braintrust",
    name: "Braintrust",
    kind: "managed",
    url: "https://www.braintrust.dev",
    summary:
      "Eval-first platform: datasets, scorers, experiments grid, online scoring and prompt playground.",
    domains: ["quality", "drift", "visibility", "governance"],
  },
  {
    id: "langsmith",
    name: "LangSmith",
    kind: "managed",
    url: "https://smith.langchain.com",
    summary:
      "Tracing, datasets, evaluators, prompt hub and annotation queues; tight LangChain/LangGraph fit.",
    domains: ["visibility", "quality", "drift", "governance", "safety"],
  },
  {
    id: "opik",
    name: "Opik (Comet)",
    kind: "both",
    url: "https://www.comet.com/site/products/opik/",
    summary:
      "Tracing, evals and annotation queues with automation rules; OSS and managed.",
    domains: ["quality", "visibility"],
  },
  {
    id: "helicone",
    name: "Helicone",
    kind: "both",
    url: "https://www.helicone.ai",
    summary:
      "Proxy-based request logging, sessions, cost analytics and caching.",
    domains: ["visibility", "cost-performance", "quality"],
  },
  {
    id: "openlit",
    name: "OpenLIT",
    kind: "open-source",
    url: "https://openlit.io",
    summary:
      "OTel-native GenAI instrumentation and dashboards; exports to any OTel backend.",
    domains: ["visibility", "cost-performance"],
  },
  {
    id: "litellm",
    name: "LiteLLM",
    kind: "both",
    url: "https://www.litellm.ai",
    summary:
      "OSS gateway: unified API, budgets, rate limits, fallbacks, routing, caching.",
    domains: ["cost-performance", "drift", "safety", "governance"],
  },
  {
    id: "portkey",
    name: "Portkey",
    kind: "both",
    url: "https://portkey.ai",
    summary:
      "AI gateway with routing configs, guardrails, budgets, caching and audit logs.",
    domains: ["cost-performance", "drift", "safety", "governance"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "managed",
    url: "https://openrouter.ai",
    summary:
      "Multi-provider routing with fallbacks, spend limits per key and model deprecation visibility.",
    domains: ["cost-performance", "drift"],
  },
  {
    id: "guardrails-ai",
    name: "Guardrails AI",
    kind: "both",
    url: "https://www.guardrailsai.com",
    summary:
      "Validator hub for structured output, PII, toxicity and hallucination checks.",
    domains: ["safety"],
  },
  {
    id: "nemo-guardrails",
    name: "NVIDIA NeMo Guardrails",
    kind: "open-source",
    url: "https://github.com/NVIDIA/NeMo-Guardrails",
    summary:
      "Programmable rails (Colang) for input, output, dialog and tool-use policies.",
    domains: ["safety"],
  },
  {
    id: "llama-guard",
    name: "Llama Guard",
    kind: "open-source",
    url: "https://www.llama.com/trust-and-safety/",
    summary:
      "Open safety classifier for prompts and responses across a hazard taxonomy.",
    domains: ["safety"],
  },
  {
    id: "lakera",
    name: "Lakera Guard (Check Point)",
    kind: "managed",
    url: "https://www.lakera.ai",
    summary:
      "Managed prompt-injection, jailbreak and content-moderation API with strictness levels.",
    domains: ["safety"],
  },
  {
    id: "presidio",
    name: "Microsoft Presidio",
    kind: "open-source",
    url: "https://microsoft.github.io/presidio/",
    summary: "PII detection and anonymisation for text and images.",
    domains: ["safety", "visibility", "governance"],
  },
  {
    id: "promptfoo",
    name: "promptfoo",
    kind: "both",
    url: "https://www.promptfoo.dev",
    summary:
      "CLI/CI evals and red-teaming for prompts, RAG and agents; OWASP-aligned plugins.",
    domains: ["quality", "safety", "drift"],
  },
  {
    id: "garak",
    name: "garak",
    kind: "open-source",
    url: "https://github.com/NVIDIA/garak",
    summary:
      "LLM vulnerability scanner with probes for injection, leakage and toxicity.",
    domains: ["safety"],
  },
  {
    id: "deepeval",
    name: "DeepEval",
    kind: "both",
    url: "https://www.confident-ai.com/products/deepeval",
    summary:
      "Pytest-style LLM evals: faithfulness, hallucination, tool correctness, red-team metrics.",
    domains: ["quality", "safety"],
  },
  {
    id: "ragas",
    name: "Ragas",
    kind: "open-source",
    url: "https://docs.ragas.io",
    summary:
      "Reference metrics for RAG: context precision/recall, faithfulness, answer relevance.",
    domains: ["quality", "safety", "visibility"],
  },
  {
    id: "latitude",
    name: "Latitude",
    kind: "both",
    url: "https://latitude.so",
    summary:
      "Prompt engineering platform with versioning, evals and an agent score.",
    domains: ["drift", "quality"],
  },
  {
    id: "e2b",
    name: "E2B",
    kind: "both",
    url: "https://e2b.dev",
    summary: "Secure cloud sandboxes for AI-generated code execution.",
    domains: ["safety"],
  },
  {
    id: "grafana",
    name: "Grafana + Prometheus",
    kind: "both",
    url: "https://grafana.com",
    summary:
      "Dashboards and alert rules over OTel metrics; pairs with any OTel collector.",
    domains: ["visibility", "cost-performance", "drift"],
  },
]

export function getTool(id: string) {
  return tools.find((t) => t.id === id)
}

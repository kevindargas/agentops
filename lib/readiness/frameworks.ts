import type { FrameworkDef, FrameworkId, FrameworkRefs } from "./types"

export const frameworks: FrameworkDef[] = [
  {
    id: "owasp",
    name: "OWASP Top 10 for LLM Applications (2025)",
    short: "OWASP LLM Top 10",
    url: "https://genai.owasp.org/llm-top-10/",
    items: [
      { id: "LLM01", title: "Prompt Injection" },
      { id: "LLM02", title: "Sensitive Information Disclosure" },
      { id: "LLM03", title: "Supply Chain" },
      { id: "LLM04", title: "Data and Model Poisoning" },
      { id: "LLM05", title: "Improper Output Handling" },
      { id: "LLM06", title: "Excessive Agency" },
      { id: "LLM07", title: "System Prompt Leakage" },
      { id: "LLM08", title: "Vector and Embedding Weaknesses" },
      { id: "LLM09", title: "Misinformation" },
      { id: "LLM10", title: "Unbounded Consumption" },
    ],
  },
  {
    id: "nist",
    name: "NIST AI RMF 1.0 with the Generative AI Profile (AI 600-1)",
    short: "NIST AI RMF",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    items: [
      {
        id: "GOVERN 1.2",
        title: "Trustworthy AI characteristics integrated into policies",
      },
      {
        id: "GOVERN 1.3",
        title: "Risk management activities proportionate to risk level",
      },
      {
        id: "GOVERN 1.4",
        title: "Risk management process is transparent and resourced",
      },
      {
        id: "GOVERN 1.5",
        title: "Ongoing monitoring and periodic review planned",
      },
      { id: "GOVERN 1.6", title: "Inventory of AI systems and their data" },
      {
        id: "GOVERN 1.7",
        title: "Decommissioning and change processes in place",
      },
      {
        id: "GOVERN 2.1",
        title: "Roles, responsibilities and lines of communication",
      },
      {
        id: "GOVERN 3.1",
        title: "Decision-making is informed by a diverse team",
      },
      {
        id: "GOVERN 3.2",
        title: "Policies for human-AI configurations and oversight",
      },
      { id: "GOVERN 4.3", title: "Incident and error communication practices" },
      {
        id: "GOVERN 5.1",
        title: "Feedback from external stakeholders collected",
      },
      { id: "GOVERN 6.1", title: "Third-party risks addressed" },
      {
        id: "MAP 1.1",
        title: "Intended purpose, context and users documented",
      },
      { id: "MAP 2.1", title: "Tasks and methods documented" },
      { id: "MAP 2.3", title: "Scientific integrity of data and methods" },
      {
        id: "MAP 3.4",
        title: "Operator and practitioner proficiency and data handling",
      },
      { id: "MAP 4.1", title: "Third-party technology risks mapped" },
      { id: "MAP 5.1", title: "Likelihood and magnitude of impacts assessed" },
      {
        id: "MAP 5.2",
        title: "Practices for engaging with impacted communities",
      },
      {
        id: "MEASURE 2.3",
        title: "Performance demonstrated for conditions of deployment",
      },
      { id: "MEASURE 2.4", title: "Functionality monitored in production" },
      {
        id: "MEASURE 2.5",
        title: "System is valid and reliable; evidence documented",
      },
      { id: "MEASURE 2.6", title: "System is safe; residual risk evaluated" },
      { id: "MEASURE 2.7", title: "Security and resilience evaluated" },
      { id: "MEASURE 2.9", title: "Outputs explained and validated" },
      { id: "MEASURE 2.10", title: "Privacy risk assessed and documented" },
      {
        id: "MEASURE 3.1",
        title: "Mechanisms to track identified risks over time",
      },
      { id: "MEASURE 3.3", title: "Feedback processes for end users" },
      {
        id: "MEASURE 4.2",
        title: "Measurement results validated and documented",
      },
      {
        id: "MANAGE 2.2",
        title: "Mechanisms to sustain value and respond to change",
      },
      {
        id: "MANAGE 2.3",
        title: "Procedures to respond to previously unknown risks",
      },
      {
        id: "MANAGE 2.4",
        title: "Mechanisms to supersede, disengage or deactivate",
      },
      {
        id: "MANAGE 4.1",
        title: "Post-deployment monitoring plans implemented",
      },
      {
        id: "MANAGE 4.3",
        title: "Incidents and errors communicated to relevant parties",
      },
    ],
  },
  {
    id: "eu-ai-act",
    name: "EU AI Act (Regulation 2024/1689) obligations",
    short: "EU AI Act",
    url: "https://artificialintelligenceact.eu/",
    items: [
      { id: "Art. 9", title: "Risk management system" },
      { id: "Art. 10", title: "Data and data governance" },
      { id: "Art. 11", title: "Technical documentation" },
      { id: "Art. 12", title: "Record-keeping (automatic logs)" },
      {
        id: "Art. 13",
        title: "Transparency and provision of information to deployers",
      },
      { id: "Art. 14", title: "Human oversight" },
      { id: "Art. 15", title: "Accuracy, robustness and cybersecurity" },
      { id: "Art. 17", title: "Quality management system" },
      {
        id: "Art. 26",
        title: "Obligations of deployers of high-risk AI systems",
      },
      { id: "Art. 27", title: "Fundamental rights impact assessment" },
      {
        id: "Art. 50",
        title: "Transparency obligations (AI interaction disclosure)",
      },
      { id: "Art. 72", title: "Post-market monitoring" },
      { id: "Art. 73", title: "Reporting of serious incidents" },
    ],
  },
  {
    id: "otel",
    name: "OpenTelemetry GenAI semantic conventions",
    short: "OTel GenAI",
    url: "https://opentelemetry.io/docs/specs/semconv/gen-ai/",
    items: [
      {
        id: "gen_ai.operation.name",
        title: "Operation: chat, embeddings, execute_tool, invoke_agent…",
      },
      {
        id: "gen_ai.operation.name=execute_tool",
        title: "Tool execution span",
      },
      {
        id: "gen_ai.operation.name=invoke_agent",
        title: "Agent invocation span",
      },
      {
        id: "gen_ai.operation.name=retrieve",
        title: "Retrieval span (vendor extension)",
      },
      { id: "gen_ai.request.model", title: "Model requested" },
      { id: "gen_ai.response.model", title: "Model that actually responded" },
      { id: "gen_ai.request.max_tokens", title: "Max output tokens requested" },
      { id: "gen_ai.usage.input_tokens", title: "Input token count" },
      { id: "gen_ai.usage.output_tokens", title: "Output token count" },
      { id: "gen_ai.response.finish_reasons", title: "Finish reasons" },
      {
        id: "gen_ai.conversation.id",
        title: "Conversation / session identifier",
      },
      { id: "gen_ai.agent.name", title: "Agent name" },
      { id: "gen_ai.agent.id", title: "Agent identifier" },
      { id: "gen_ai.tool.name", title: "Tool name" },
      { id: "gen_ai.tool.call.id", title: "Tool call identifier" },
      {
        id: "gen_ai.client.operation.duration",
        title: "Client operation duration histogram",
      },
      {
        id: "gen_ai.client.token.usage",
        title: "Client token usage histogram",
      },
      { id: "gen_ai.server.time_to_first_token", title: "Time to first token" },
      {
        id: "db.vector.query.top_k",
        title: "Vector query top-k (db conventions)",
      },
    ],
  },
  {
    id: "iso-42001",
    name: "ISO/IEC 42001:2023 AI management system: Annex A controls",
    short: "ISO/IEC 42001",
    url: "https://www.iso.org/standard/42001",
    items: [
      { id: "A.2", title: "Policies related to AI" },
      {
        id: "A.3",
        title: "Internal organization (roles, responsibilities, concerns)",
      },
      { id: "A.4", title: "Resources for AI systems (data, tooling, people)" },
      { id: "A.5", title: "Assessing impacts of AI systems" },
      {
        id: "A.6",
        title:
          "AI system life cycle (requirements, verification, deployment, operation)",
      },
      {
        id: "A.7",
        title: "Data for AI systems (provenance, quality, preparation)",
      },
      {
        id: "A.8",
        title: "Information for interested parties (documentation, incidents)",
      },
      {
        id: "A.9",
        title: "Use of AI systems (responsible use, intended use, objectives)",
      },
      {
        id: "A.10",
        title: "Third-party and customer relationships (suppliers)",
      },
    ],
  },
]

export const frameworkKey: Record<FrameworkId, keyof FrameworkRefs> = {
  owasp: "owasp",
  nist: "nist",
  "eu-ai-act": "euAiAct",
  otel: "otel",
  "iso-42001": "iso42001",
}

export function getFramework(id: FrameworkId) {
  return frameworks.find((f) => f.id === id)!
}

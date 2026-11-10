# Runbook: run a readiness assessment

## When to use

Before a system moves from prototype to pilot or pilot to production, after a material change to its profile (autonomy, data sensitivity, exposure, regulatory scope), at the monthly review, or when an auditor asks for evidence.

## Steps

1. Open Readiness Assessment (`/agentops/readiness`, chord G Y). Everything you do here stays in this browser under `agentops.readiness.v1`.
2. **Setup tab.** Fill in the system profile: name, system type (Chatbot, RAG assistant, Single agent, Multi-agent system), autonomy (Assist, Supervised, Autonomous), data sensitivity (Public to Regulated), exposure (Internal, External) and regulatory scopes (EU AI Act, GDPR, HIPAA, PCI DSS, SOC 2, ISO/IEC 42001). Pick the maturity target (Prototype, Pilot, Production). Press "Start assessment". The profile drives which of the 86 controls apply, which are down-weighted and which are required.
3. **Controls tab.** Work domain by domain (Visibility, Quality, Drift, Safety, Cost & Performance, Governance). For each control open the sheet and read what, why, how and "done looks like"; the Previous and Next buttons in the sheet footer walk the list without closing it. Set the status honestly:
   - Not started: nothing exists.
   - Planned: owner and plan agreed, not built.
   - Partial: exists for some agents, paths or environments.
   - In place: implemented everywhere it applies.
   - Verified: implemented and the "done looks like" test passed with evidence.
     Fill owner, tool, evidence (a link into this app is fine, for example `/agentops/traces`), last reviewed and notes. Toggle "show not applicable" if you want to see hidden controls.
4. **Team mode (optional).** Set your full name as respondent (for example Amara Okafor) and vote per control; ask the other owners to do the same from the shared link. The consensus is the majority with ties resolving downward; large spreads flag controls to discuss. "Apply consensus to all" on the Share tab confirms with the number of controls it overwrites.
5. **Results tab.** Read overall score, maturity level (Ad hoc, Defined, Managed, Optimized), the radar and heatmap, the release-gate panel (blockers: required gate controls not in place) and the prioritised gap table (severity, then effort). Reviews due are listed here as well.
6. **Frameworks tab.** Check coverage of OWASP LLM Top 10, NIST AI RMF, EU AI Act, OTel GenAI and ISO/IEC 42001 items. Use the CSV or Markdown button on the framework you need and attach the file to the compliance report.
7. **Tooling tab.** For each gap, the tool matrix, metric catalog and snippets tell you what to install and what to measure.
8. **Share tab.** Press "Take snapshot" and name it (for example "Pilot exit review"). Export Markdown for the record, JSON for re-import, CSV for a spreadsheet, or print to PDF. "Copy link" puts a URL with the whole assessment in the fragment on your clipboard; share it only with people allowed to see every answer, and prefer the JSON export when the page warns that the link is over 2,000 characters. Whoever opens the link with an assessment already in their browser is asked before it is replaced, and their previous answers are kept as the snapshot "Before import". "Compare" on a snapshot shows the run-to-run diff; deleting a snapshot asks for confirmation and offers Undo.
9. Decide. For a production target, zero blockers is the bar. For a pilot, blockers may be accepted with named owners and dates recorded in the notes.
10. Schedule the next review from the cadence list and put the overdue items on the weekly checklist.

## What to record

- The snapshot (kept in the browser store) and the exported Markdown in your governance repository.
- Nothing on this page writes to the Audit Log in the sample app; the exported files and snapshots are the record.

## Who to notify

- Control owners for every gap assigned to them.
- The release approvers, with the blockers list, before any production release of the system.
- Compliance or legal for regulated scopes; they get the Frameworks export.

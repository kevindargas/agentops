# Runbook: rotate an API key

## When to use

A key on Providers & Routing, Keys tab shows status Expiring (the sample `gateway-prod-openai` expires in 9 days), a key may have leaked, an owner left, or the quarterly access review requires it.

## Steps

1. Open Providers & Routing, Keys tab (`/agentops/providers?tab=keys`). Click the key to open its detail sheet (`?key=<id>`). Note the provider, environment, scopes, owner, last used and 30-day spend.
2. Find who depends on it. The sheet lists "Routing rules on this provider" with the agents each rule matches (click a rule to open it on the Routing tab) and "Quotas scoped to this key". Check the key's scopes against what those chains need; a key whose scopes exceed the chain is a finding.
3. Press Rotate (row menu or sheet footer). Enter the reason (scheduled, leak, owner change) in the dialog and confirm. The template issues the replacement itself: a new Active key with the same name, provider, scopes, environment and owner appears at the top of the table, and the old key turns Rotating with "Grace period ends" set 24 hours ahead (`keyRotationGraceHours`). In a wired deployment this is the moment the gateway accepts both keys.
4. Copy the new secret from the "Key rotated" dialog with its Copy key button, and only into the secret store. It is shown once. Never paste it into a ticket.
5. Move consumers to the new key before the grace period ends. Confirm on the provider card that `requests24h` continues and `errorRate` does not jump. Use Test (the result is simulated in the template).
6. Once `lastUsed` on the old key stops advancing, press Revoke on the Rotating row, give the reason, confirm. Status becomes Revoked with the expiry set to now; the toast offers Undo for eight seconds. Do not delete the record; spend history stays attached to it.
7. If the rotation was because of a suspected leak, use Audit history (row menu or sheet footer, `/agentops/audit?source=api-key`) and check Costs & Budgets for unexpected spend on the provider in the last days.

## What to record

- The reason entered in the Rotate and Revoke dialogs is kept with both keys for the session and shown as "Last change note" in the detail sheet, so the quarterly access review can read it.
- In a wired deployment, Rotate and Revoke should each write an `api-key` audit event with the actor and the key id. The template does not write audit events; the `api-key` events on the Audit Log are sample data.

## Who to notify

- Key owner (`ownerId`) and the owners of agents routed through the provider.
- Security if the reason is a suspected leak.
- Finance or budget owner if monthly spend attribution moves to a new key.

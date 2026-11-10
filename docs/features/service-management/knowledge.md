# Knowledge

Knowledge holds the human-facing articles: how-tos, known errors and policy pages across the IT, HR, Facilities and Security knowledge bases. Articles move from Draft through Review to Published and eventually Retired. Incidents suggest published articles, problems publish known errors here, and the Knowledge Curator workflow agent proposes drafts and retirements.

This is distinct from Knowledge & Memory under Build (`/agentops/knowledge`), which is the retrieval infrastructure agents use; that module indexes this knowledge base as one of its sources.

## Where to find it

- List: `/itsm/knowledge`. Sidebar: Service Management, Knowledge. Chord `G` then `K`.
- Record: `/itsm/knowledge/<number>`, for example `/itsm/knowledge/KB0010231`.
- New article sheet: `/itsm/knowledge?new=1` opens it on load (used by quick create and the command menu); the header's "New article" opens the same sheet.
- Code: `app/(app)/itsm/knowledge/page.tsx`, `[number]/page.tsx`, `features/knowledge/knowledge-table.tsx`, `new-article-sheet.tsx`, `knowledge-store.ts`. Data: `knowledgeArticles` in `lib/data/catalog.ts` (not `lib/data/knowledge.ts`).

## What is on the page

### List page

**Header.** Driven by the nav entry (eyebrow "Service Management", icon, title), with "New article" (opens the create sheet).

**Stat tiles.** Compact tiles without icons: Published articles (hint: number of knowledge bases), Awaiting review (state Review; hint: drafts in progress), Total views (lifetime, no trend because the data has no view history), Helpful rating (helpful over helpful plus not helpful across all articles; hint: total votes).

**New article sheet.** Two sections: Article (Title, required, 120 characters; Summary, required) and Where it lives (Knowledge base from the bases in the data; Category from that base's existing categories; comma-separated Tags). "Create draft" appends a Draft by the current user with zero views and votes to `knowledgeStore`, so it appears in the table, and toasts "Draft KB... created". Closing a dirty form asks to discard; `?new=1` is stripped on close.

**Table.** Default sort Views descending.

| Column         | Content                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Number         | link to the article                                                                                    |
| Title          | title with the summary beneath                                                                         |
| Knowledge base | IT, HR, Facilities or Security badge                                                                   |
| State          | state badge                                                                                            |
| Views          | formatted count                                                                                        |
| Helpful        | percent, tooltip with raw helpful and not-helpful counts; the header has a tooltip defining the figure |
| Author         | user chip                                                                                              |
| Updated        | relative date                                                                                          |

Facets: Knowledge base, State. Search matches number, title, summary and tags. The table reads `knowledgeStore`, so a draft created from the sheet appears without a reload.

### Record page

**Toolbar.** Number; badges State (reads `knowledgeStore`), knowledge base, category. Actions: "Share" copies the article URL to the clipboard (toasts an error if the clipboard is unavailable); "Edit article" opens a dialog that saves title and summary to `knowledgeStore` for the session. Overflow: Subscribe to updates / Unsubscribe (local toggle), Flag for review (sets state Review), Retire article (confirmation, then state Retired; disabled when already Retired). Print was removed.

**Meta chips.** Author, Updated, Views, Helpful (green at 85 percent or more, default at 70 to 84, amber below; "No votes yet" when unrated).

**Aside.** On this page (table of contents: Overview, Before you begin, Steps, Verify the fix, Still need help?), Article details (author, knowledge base and category, Published date or "Not yet published", Valid to = published plus 365 days, last updated, tags), Engagement (helpful bar, views, helpful, not helpful), Related articles (up to four published articles from the same knowledge base).

**Main.** The article body. In the template every article renders the same five-section body text, personalized with the knowledge base name and the article number; the real content is the title and summary. Below it a feedback card ("Was this article helpful?" Yes / No with counts; one vote per session that can be switched or withdrawn, updating the counts) and a "Browse all <KB> articles" link.

## What to check

Every day

- Awaiting review tile. Articles in Review are usually workarounds for live problems (the seeded one is the Wi-Fi workaround tied to `CHG0031122`). Review and publish, or send back to Draft.

Every week

- Helpful rating below 70 percent (amber chip) on a high-view article. Open it, read the summary and flag it for review; the Knowledge Curator agent also proposes merges and retirements in the AgentOps Assist queue.
- Valid to. Published plus one year is the review horizon; articles whose Valid to date has passed should be re-reviewed. The seed has several published 400 to 2400 days ago.
- Retired articles with high views (for example the legacy fileshare article). Make sure a replacement article exists and that the retired one points at it in its summary.
- Known errors in Problems without a matching article here; search the problem title.
- Drafts with zero views older than a week are abandoned; assign or delete.

## Actions

| Action                             | Behaviour in the template                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| New article (header, `?new=1`)     | opens the create sheet; "Create draft" appends a Draft to `knowledgeStore` and toasts its number                                         |
| Share                              | copies the article URL to the clipboard                                                                                                  |
| Edit article                       | dialog; saves title and summary to `knowledgeStore`                                                                                      |
| Subscribe to updates / Unsubscribe | local toggle                                                                                                                             |
| Flag for review                    | sets state Review                                                                                                                        |
| Retire article                     | confirmation ("hidden from search and the self-service portal but remain available to agents") then state Retired; disabled when Retired |
| Yes / No feedback                  | one vote per session, switchable; counts update                                                                                          |
| TOC links                          | scroll to the section                                                                                                                    |

Record actions write `knowledgeStore` for the session only; nothing is persisted.

## Reading the data

**States** (`KnowledgeState`) and tones: Draft (grey), Review (amber), Published (green), Retired (grey).

- Knowledge bases: IT, HR, Facilities, Security. Incidents suggest IT articles, or Security articles for Security-category incidents.
- Helpful percent is `helpful / (helpful + notHelpful)`; zero votes shows "No votes yet" and an empty engagement bar.
- Tags are free-form strings shown as badges and used by search (for example `known-error`, `workaround`).
- Published is optional; Draft and Review articles have none, and therefore no Valid to.

## How the data gets here

`knowledgeArticles` in `lib/data/catalog.ts` is a static array of 12 articles (`KB0010122` to `KB0030012`) with title, summary, knowledge base, category, state, author, views, helpful and not-helpful counts, updated and published dates relative to `NOW`, and tags. The article body on the record page is fixed JSX, not data.

The same array feeds the Knowledge tab on incident records, the command menu record search, the "recently viewed" trail on My Work and the `itsm-knowledge` knowledge base in `lib/data/knowledge.ts`. Drafts created in the browser live in `knowledgeStore` (`features/knowledge/knowledge-store.ts`) and are not persisted. Replace the array with an API client returning `KnowledgeArticle` from `lib/types.ts`, and render real article bodies in place of the template sections.

## Related pages

- [Incidents](./incidents.md) (Knowledge tab, "Create knowledge article"), [Problems](./problems.md) (known errors)
- [Service Catalog](./service-catalog.md) (same data module)
- Knowledge & Memory (`/agentops/knowledge`) under Build for the agent retrieval side
- AgentOps Assist on an article: [Assistant and shell](../assistant-and-shell.md)

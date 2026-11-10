import type { Metadata } from "next"
import Link from "next/link"
import {
  ArchiveIcon,
  BellIcon,
  BookOpenIcon,
  CalendarIcon,
  EyeIcon,
  FlagIcon,
  LinkIcon,
  ListIcon,
  PencilIcon,
  PrinterIcon,
  Share2Icon,
  TagIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress"
import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection, SummaryRow } from "@/components/record/record-section"
import { RelatedRecordCard } from "@/components/record/related-record-card"
import { DetailList } from "@/components/shared/detail-list"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { getUser, knowledgeArticles } from "@/lib/data"
import { formatDate, formatNumber, timeAgo } from "@/lib/format"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>
}): Promise<Metadata> {
  const { number } = await params
  return {
    title: knowledgeArticles.find((k) => k.number === number)?.title ?? number,
  }
}

const toc = [
  { id: "overview", label: "Overview" },
  { id: "before-you-begin", label: "Before you begin" },
  { id: "steps", label: "Steps" },
  { id: "verify", label: "Verify the fix" },
  { id: "still-need-help", label: "Still need help?" },
]

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group/h scroll-mt-28 font-heading text-lg font-semibold tracking-tight"
    >
      <a
        href={`#${id}`}
        className="inline-flex items-center gap-2 no-underline"
      >
        {children}
        <LinkIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/h:opacity-100" />
      </a>
    </h2>
  )
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ number: string }>
}) {
  const { number } = await params
  const article = knowledgeArticles.find((k) => k.number === number)
  if (!article)
    return (
      <RecordNotFound
        number={number}
        backHref="/itsm/knowledge"
        backLabel="knowledge"
      />
    )
  const related = knowledgeArticles
    .filter(
      (k) =>
        k.number !== article.number &&
        k.knowledgeBase === article.knowledgeBase &&
        k.state === "Published"
    )
    .slice(0, 4)
  const votes = article.helpful + article.notHelpful
  const pct = Math.round((article.helpful / Math.max(1, votes)) * 100)
  const author = getUser(article.authorId)
  const validTo = article.published
    ? new Date(
        new Date(article.published).getTime() + 365 * 86_400_000
      ).toISOString()
    : undefined

  return (
    <>
      <RecordHeader
        number={article.number}
        title={article.title}
        backHref="/itsm/knowledge"
        backLabel="knowledge"
        description={article.summary}
        badges={
          <>
            <StateBadge state={article.state} />
            <Badge variant="secondary">
              <BookOpenIcon /> {article.knowledgeBase}
            </Badge>
            <Badge variant="outline">{article.category}</Badge>
          </>
        }
        meta={
          <>
            <MetaItem label="Author" icon={<UserIcon />}>
              <UserChip userId={article.authorId} size="xs" />
            </MetaItem>
            <MetaItem label="Updated" icon={<CalendarIcon />}>
              {timeAgo(article.updated)}
            </MetaItem>
            <MetaItem label="Views" icon={<EyeIcon />}>
              {formatNumber(article.views, true)}
            </MetaItem>
            <MetaItem
              label="Helpful"
              icon={<ThumbsUpIcon />}
              tone={
                votes === 0
                  ? "default"
                  : pct >= 85
                    ? "success"
                    : pct >= 70
                      ? "default"
                      : "warning"
              }
            >
              {votes === 0 ? "No votes yet" : `${pct}%`}
            </MetaItem>
          </>
        }
        actions={
          <>
            <Button variant="outline">
              <Share2Icon /> Share
            </Button>
            <Button>
              <PencilIcon /> Edit article
            </Button>
          </>
        }
        overflow={[
          {
            label: "Subscribe to updates",
            icon: <BellIcon />,
            message: `Subscribed to ${article.number}`,
          },
          {
            label: "Flag for review",
            icon: <FlagIcon />,
            message: "Flagged — the knowledge manager has been notified",
          },
          {
            label: "Print",
            icon: <PrinterIcon />,
            message: "Preparing print view…",
          },
          {
            label: "Retire article",
            icon: <ArchiveIcon />,
            destructive: true,
            separatorBefore: true,
            disabled: article.state === "Retired",
            confirm: {
              title: `Retire ${article.number}?`,
              description:
                "Retired articles are hidden from search and the Employee Center but remain available to agents.",
              actionLabel: "Retire article",
            },
            message: `${article.number} retired`,
          },
        ]}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection
              title="On this page"
              icon={<ListIcon />}
              size="sm"
              className="xl:sticky xl:top-28"
            >
              <nav aria-label="Table of contents">
                <ol className="flex flex-col border-l text-sm">
                  {toc.map((t) => (
                    <li key={t.id}>
                      <a
                        href={`#${t.id}`}
                        className="-ml-px block border-l border-transparent py-1 pl-3 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                      >
                        {t.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </RecordSection>

            <RecordSection
              title="Article details"
              size="sm"
              contentClassName="flex flex-col gap-3"
            >
              <DetailList
                columns={1}
                className="gap-y-3"
                items={[
                  {
                    label: "Author",
                    value: (
                      <UserChip userId={article.authorId} showTitle size="md" />
                    ),
                  },
                  {
                    label: "Knowledge base",
                    value: `${article.knowledgeBase} · ${article.category}`,
                  },
                  {
                    label: "Published",
                    value: article.published ? (
                      formatDate(article.published)
                    ) : (
                      <span className="text-muted-foreground italic">
                        Not yet published
                      </span>
                    ),
                  },
                  {
                    label: "Valid to",
                    value: validTo ? formatDate(validTo) : undefined,
                  },
                  {
                    label: "Last updated",
                    value: `${formatDate(article.updated)} (${timeAgo(article.updated)})`,
                  },
                  {
                    label: "Tags",
                    value: (
                      <div className="flex flex-wrap gap-1">
                        {article.tags.map((t) => (
                          <Badge key={t} variant="outline">
                            <TagIcon /> {t}
                          </Badge>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </RecordSection>

            <RecordSection
              title="Engagement"
              icon={<EyeIcon />}
              size="sm"
              contentClassName="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Helpful rating</span>
                  <span className="text-muted-foreground tabular-nums">
                    {votes === 0 ? "—" : `${pct}% of ${formatNumber(votes)}`}
                  </span>
                </div>
                <Progress
                  value={pct}
                  aria-label="Helpful rating"
                  className="gap-0"
                >
                  <ProgressTrack className="h-1.5">
                    <ProgressIndicator
                      className={
                        pct >= 85
                          ? "bg-success"
                          : pct >= 70
                            ? "bg-brand"
                            : "bg-warning"
                      }
                    />
                  </ProgressTrack>
                </Progress>
              </div>
              <SummaryRow label="Views">
                {formatNumber(article.views)}
              </SummaryRow>
              <SummaryRow label="Helpful">
                {formatNumber(article.helpful)}
              </SummaryRow>
              <SummaryRow label="Not helpful">
                {formatNumber(article.notHelpful)}
              </SummaryRow>
            </RecordSection>

            <RecordSection
              title="Related articles"
              count={related.length}
              size="sm"
              contentClassName="flex flex-col gap-2"
            >
              {related.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No other published articles in this knowledge base.
                </p>
              ) : (
                related.map((r) => (
                  <RelatedRecordCard
                    key={r.number}
                    number={r.number}
                    type={r.category}
                    title={r.title}
                    href={`/itsm/knowledge/${r.number}`}
                    icon={<BookOpenIcon />}
                    meta={`${formatNumber(r.views, true)} views`}
                  />
                ))
              )}
            </RecordSection>
          </>
        }
      >
        <Card>
          <CardContent className="py-2">
            <article className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 text-[15px] leading-7 text-foreground/90 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:text-pretty [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
              <p className="text-base leading-7 text-muted-foreground">
                {article.summary}
              </p>

              <section className="flex flex-col gap-3">
                <H2 id="overview">Overview</H2>
                <p>
                  This article describes the recommended procedure and the most
                  common pitfalls. Follow the steps in order; each step includes
                  the expected outcome so you can confirm progress before
                  continuing.
                </p>
                <p>
                  It applies to all managed devices in the{" "}
                  <strong>{article.knowledgeBase}</strong> knowledge base scope.
                  Personal devices enrolled through the Employee Center follow
                  the same flow, but some screens may differ slightly.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <H2 id="before-you-begin">Before you begin</H2>
                <ul>
                  <li>
                    Make sure you are connected to the corporate network or VPN.
                  </li>
                  <li>
                    Have your <code>multi-factor</code> device to hand — you
                    will be asked to approve a push notification.
                  </li>
                  <li>
                    Close any open sessions of the affected application so
                    cached settings are not reused.
                  </li>
                </ul>
              </section>

              <section className="flex flex-col gap-3">
                <H2 id="steps">Steps</H2>
                <ol>
                  <li>
                    Open the relevant application or portal and sign in with
                    your corporate credentials.
                  </li>
                  <li>
                    Navigate to the settings or configuration area referenced in
                    the summary above.
                  </li>
                  <li>
                    Apply the recommended configuration. If prompted for
                    multi-factor authentication, approve the push notification.
                  </li>
                  <li>
                    Restart the application so the new configuration is loaded.
                  </li>
                </ol>
                <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm leading-6">
                  <strong className="text-info">Tip.</strong> If the
                  configuration screen is greyed out, your device policy has not
                  yet refreshed. Lock and unlock your device, wait two minutes,
                  and try again.
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <H2 id="verify">Verify the fix</H2>
                <p>
                  Confirm the change took effect by repeating the action that
                  originally failed. If the issue persists, collect the exact
                  error message and the time it occurred — both speed up triage
                  considerably.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <H2 id="still-need-help">Still need help?</H2>
                <p>
                  If these steps do not resolve the issue, raise an incident
                  through the Employee Center and reference{" "}
                  <code>{article.number}</code>. The Service Desk will see the
                  steps you have already tried.
                </p>
                <p className="text-sm text-muted-foreground">
                  Last reviewed {formatDate(article.updated)} by{" "}
                  {author?.name ?? "the knowledge team"}.
                </p>
              </section>
            </article>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm font-medium">Was this article helpful?</p>
            <div className="flex gap-2">
              <Button variant="outline">
                <ThumbsUpIcon /> Yes{" "}
                <span className="text-muted-foreground tabular-nums">
                  ({formatNumber(article.helpful)})
                </span>
              </Button>
              <Button variant="outline">
                <ThumbsDownIcon /> No{" "}
                <span className="text-muted-foreground tabular-nums">
                  ({formatNumber(article.notHelpful)})
                </span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {votes === 0
                ? "Be the first to rate this article."
                : `${pct}% of ${formatNumber(votes)} readers found this helpful.`}
            </p>
            <Link
              href="/itsm/knowledge"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Browse all {article.knowledgeBase} articles
            </Link>
          </CardContent>
        </Card>
      </RecordLayout>
    </>
  )
}

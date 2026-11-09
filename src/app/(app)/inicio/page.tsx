"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Compass, ChevronRight, CalendarDays, Trophy, FolderKanban, UserPlus, Mail, Hand } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { CreatorTable, type TableItem } from "@/components/home/CreatorTable";
import { Avatar, GroupImage, ProjectCover } from "@/components/ui/Avatar";
import { Chip, SectionHeader, Skeleton, ErrorState } from "@/components/ui/kit";
import { useApp } from "@/lib/app-context";
import { useRpc } from "@/lib/hooks";
import type { HomeFeed, TableCard } from "@/lib/types";
import { errorMessage, formatDateTime, relativeTime, t } from "@/i18n";

function tableLabel(c: TableCard) {
  return c.headline || (c.project_title ? `Creando ${c.project_title}` : t.options.stage[c.stage ?? "exploring"]?.label ?? "");
}

export default function Home() {
  const { me } = useApp();
  const router = useRouter();
  const reduce = useReducedMotion();
  const table = useRpc<TableCard[]>("creator_table", { limit: 24 });
  const feed = useRpc<HomeFeed>("home_feed", {}, { refetchOnFocus: true });

  const items: TableItem[] = useMemo(
    () => (table.data ?? []).map((c) => ({ id: c.id, name: c.display_name, label: tableLabel(c), avatar: c.avatar_url, username: c.username })),
    [table.data],
  );

  const connectButton = (
    <div className="flex flex-col items-center">
      <div className="relative">
        {!reduce && <span className="connect-ring absolute inset-0 rounded-full bg-ink" aria-hidden />}
        <Link href="/descubrir"
          className="relative inline-flex h-[60px] items-center gap-2.5 rounded-full bg-ink pl-6 pr-7 text-[17px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.14)] transition hover:bg-[#2c2f33] active:scale-[0.97] md:h-[64px] md:text-[18px]">
          <Compass className="h-5 w-5" aria-hidden /> {t.home.connect}
        </Link>
      </div>
      <span className="mt-2.5 rounded-full bg-bg/80 px-2.5 py-0.5 text-[13px] font-medium text-ink-2">{t.home.connectHint}</span>
    </div>
  );

  const f = feed.data;

  return (
    <>
      <TopBar requests={f?.requests_count ?? 0} />
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] leading-tight md:text-[32px]">{t.home.greeting(me?.display_name?.split(" ")[0] ?? "")}</h1>
            <p className="text-[15px] text-ink-2">{t.home.tableTitle}</p>
          </div>
          {f && (f.requests_count > 0 || f.invitations_count > 0) && (
            <div className="flex flex-wrap gap-2">
              {f.requests_count > 0 && (
                <Link href="/amigos" className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[14px] font-semibold shadow-sm hairline hover:bg-white">
                  <UserPlus className="h-4 w-4" aria-hidden /> {t.home.requests(f.requests_count)}
                </Link>
              )}
              {f.invitations_count > 0 && (
                <Link href="/grupos" className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[14px] font-semibold shadow-sm hairline hover:bg-white">
                  <Mail className="h-4 w-4" aria-hidden /> {t.home.invitations(f.invitations_count)}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Hero: the creator table */}
          <section className="min-w-0">
            <div className="relative -mx-2 md:mx-0">
              {table.loading && !table.data ? (
                <div className="mx-auto flex aspect-[9/11] w-full items-center justify-center md:aspect-[19/13.5]">{connectButton}</div>
              ) : (
                <CreatorTable
                  items={items}
                  center={connectButton}
                  emptyMessage={t.home.tableEmpty}
                  onOpen={(it) => { if (it.username) router.push(`/u/${it.username}`); }}
                />
              )}
            </div>
            {items.length > 0 && (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-[13px] text-ink-2">
                <Hand className="h-3.5 w-3.5" aria-hidden /> {t.home.dragHint}
              </p>
            )}

            <div className="mt-8 hidden lg:block">
              <Updates feed={f} loading={feed.loading} />
            </div>
          </section>

          {/* Side column (stacks below on mobile) */}
          <aside className="space-y-8">
            {feed.error && !f ? <ErrorState message={errorMessage(feed.error.code)} onRetry={feed.refetch} /> : (
              <>
                <section>
                  <SectionHeader title={t.home.yourGroups} action={<Link href="/grupos" className="text-[14px] font-semibold text-ink-2 hover:text-ink">{t.home.exploreGroups}</Link>} />
                  {feed.loading && !f ? <Skeleton className="h-36" /> : (
                    <ul className="overflow-hidden rounded-[22px] bg-card shadow-sm hairline">
                      {f?.groups.map((g, i) => (
                        <li key={g.id} className={i ? "border-t border-line" : ""}>
                          <Link href={`/grupos/${g.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa]">
                            <GroupImage src={g.image_url} name={g.name} size={42} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[15px] font-semibold">{g.name}</span>
                                {g.is_official && <Chip tone="dark" className="px-2 py-0 text-[11px]">{t.groups.official}</Chip>}
                              </span>
                              <span className="block text-[13px] text-ink-2">{t.common.members(g.member_count)}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <SectionHeader title={t.home.ranking} action={<Link href="/ranking" className="text-[14px] font-semibold text-ink-2 hover:text-ink">{t.common.seeAll}</Link>} />
                  <Link href="/ranking" className="block rounded-[22px] bg-card p-4 shadow-sm hairline hover:bg-[#fafafa]">
                    {f && f.ranking.top.length > 0 ? (
                      <ol className="space-y-2.5">
                        {f.ranking.top.map((e) => (
                          <li key={e.user.id} className="flex items-center gap-3">
                            <span className="w-5 text-center font-display text-[15px] text-ink-2">{e.rank}</span>
                            <Avatar src={e.user.avatar_url} name={e.user.display_name} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{e.user.display_name}</span>
                            <span className="text-[14px] font-semibold">{e.points} <span className="font-normal text-ink-2">{t.ranking.pts}</span></span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="flex items-center gap-2 text-[14px] text-ink-2"><Trophy className="h-4 w-4" aria-hidden />{t.home.rankingEmpty}</p>
                    )}
                    {f && <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-2">{t.home.yourPoints(f.ranking.me?.points ?? 0)}</p>}
                  </Link>
                </section>

                <section>
                  <SectionHeader title={t.home.sessions} />
                  {f && f.sessions.length > 0 ? (
                    <ul className="space-y-2">
                      {f.sessions.slice(0, 3).map((s) => (
                        <li key={s.id}>
                          <Link href={`/grupos/${s.group.slug}?tab=sessions`} className="flex items-center gap-3 rounded-[18px] bg-card px-4 py-3 shadow-sm hairline hover:bg-[#fafafa]">
                            <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-info-soft text-[#245a94]">
                              <CalendarDays className="h-5 w-5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold">{s.title}</span>
                              <span className="block truncate text-[13px] text-ink-2">{formatDateTime(s.starts_at)} · {s.group.name}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-[18px] bg-card px-4 py-3 text-[14px] text-ink-2 hairline">{feed.loading ? t.common.loading : t.home.sessionsEmpty}</p>
                  )}
                </section>

                <Link href="/proyectos" className="flex items-center gap-3 rounded-[22px] bg-ink p-4 text-white shadow-md transition hover:bg-[#2c2f33]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><FolderKanban className="h-5 w-5" aria-hidden /></span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold">{t.home.projects}</span>
                    <span className="block text-[13px] text-white/70">{t.home.projectsCta}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/60" aria-hidden />
                </Link>

                <div className="lg:hidden"><Updates feed={f} loading={feed.loading} /></div>
              </>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function Updates({ feed, loading }: { feed: HomeFeed | undefined; loading: boolean }) {
  return (
    <section>
      <SectionHeader title={t.home.updates} />
      {loading && !feed ? <Skeleton className="h-28" /> : feed && feed.updates.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {feed.updates.map((u) => (
            <motion.li key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Link href={`/proyectos/${u.project.id}`} className="flex h-full gap-3 rounded-[20px] bg-card p-3 shadow-sm hairline hover:bg-[#fafafa]">
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl"><ProjectCover src={u.project.cover_url} seed={u.project.id} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                    <Avatar src={u.author.avatar_url} name={u.author.display_name} size="xs" />
                    <span className="truncate">{u.author.display_name} · {relativeTime(u.created_at)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[15px] font-semibold">{u.project.title}</span>
                  <span className="line-clamp-2 text-[14px] text-ink-2">{u.body}</span>
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[18px] bg-card px-4 py-3 text-[14px] text-ink-2 hairline">{t.home.updatesEmpty}</p>
      )}
    </section>
  );
}

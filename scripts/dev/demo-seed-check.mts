// Verifies the demo database boots and seeds in PGlite (Node), exactly as in the browser.
import { PGlite } from "@electric-sql/pglite";
import { DEMO_SQL } from "../../src/lib/demo/sql.generated";
import { seedDemo, onDemoAccountCreated } from "../../src/lib/demo/seed";

const db = await PGlite.create();
const t0 = Date.now();
await db.exec(DEMO_SQL);
await db.exec(`create schema demo; create table demo.meta (key text primary key, value text); create table demo.files (path text primary key, mime text not null, data text not null, created_at timestamptz default now());`);
const asUser = async <T,>(uid: string, fn: string, args: Record<string, unknown> = {}) =>
  db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]);
    const r = await tx.query<{ r: T }>(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(args)]);
    return r.rows[0].r;
  });
await seedDemo(db, asUser);
const u = await db.query<{ id: string }>("insert into auth.users (email) values ('me@x.com') returning id");
await onDemoAccountCreated(db, u.rows[0].id);
const me = u.rows[0].id;
await asUser(me, "onboarding_save", { step: 8, data: { display_name: "Yo", username: "yo_demo", birth_date: "2000-01-01", interests: ["apps"], stage: "starting", seeking: ["people"] } });
await asUser(me, "onboarding_complete");
const feed: any = await asUser(me, "discover_feed", { limit: 30 });
const home: any = await asUser(me, "home_feed");
const table: any = await asUser(me, "creator_table");
console.log({ ms: Date.now() - t0, feed: feed.profiles.length, allowance: feed.allowance, homeGroups: home.groups.length, updates: home.updates.length, sessions: home.sessions.length, rankingTop: home.ranking.top.length, requests: home.requests_count, invitations: home.invitations_count, table: table.length });
let matches = 0;
for (const p of feed.profiles) { const r: any = await asUser(me, "swipe", { target_id: p.id, direction: "connect" }).catch((e) => ({ err: e.message })); if (r.matched) matches++; if (r.err) { console.log("stop:", r.err); break; } }
console.log({ matches });

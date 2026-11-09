/**
 * Server-side rule tests against a real Postgres with the Movo migrations applied.
 * Run: npm run test:db   (needs a local Postgres; see README "Testing")
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import pg from "pg";

const conn = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 54329),
  user: process.env.PGUSER ?? "postgres",
  database: process.env.MOVO_TEST_DB ?? "movo_test",
};
let pool: pg.Pool;

type Json = Record<string, unknown> | unknown[] | null;

/** Call an API function as a given user (or anonymously), inside its own transaction. */
async function call(uid: string | null, fn: string, args: Json = {}): Promise<any> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated" } : {})]);
    const r = await c.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(args)]);
    await c.query("commit");
    return r.rows[0].r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Run raw SQL as a user, to check RLS on direct table access. */
async function asUser(uid: string, sql: string, params: unknown[] = []) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]);
    const r = await c.query(sql, params);
    await c.query("commit");
    return r.rows;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: any) => {
    assert.match(String(e.message), new RegExp(code));
    return true;
  });
}

let n = 0;
async function newUser(name = "user"): Promise<string> {
  n++;
  const r = await pool.query("insert into auth.users (email) values ($1) returning id", [`${name}${n}@test.local`]);
  return r.rows[0].id;
}

async function onboard(uid: string, extra: Record<string, unknown> = {}) {
  n++;
  await call(uid, "onboarding_save", {
    step: 8,
    data: {
      display_name: `Persona ${n}`,
      username: `persona_${n}`,
      avatar_url: "gen:abc",
      birth_date: "2000-05-01",
      interests: ["apps", "youtube"],
      stage: "starting",
      seeking: ["people", "feedback"],
      skills: ["edicion"],
      ...extra,
    },
  });
  await call(uid, "onboarding_complete", {});
  return uid;
}

async function member(name = "m", extra: Record<string, unknown> = {}) {
  return onboard(await newUser(name), extra);
}

before(async () => {
  execSync("./scripts/db-reset-local.sh", { stdio: "ignore" });
  pool = new pg.Pool({ ...conn, max: 30 });
});
after(async () => {
  await pool.end();
});

describe("onboarding", () => {
  test("saves progress, resumes, validates and completes once", async () => {
    const u = await newUser("onb");
    await call(u, "onboarding_save", { step: 1, data: { display_name: "Lucía", username: "lucia_test" } });
    await call(u, "onboarding_save", { step: 3, data: { birth_date: "2001-02-03" } });
    const s = await call(u, "onboarding_state");
    assert.equal(s.step, 3);
    assert.equal(s.profile.username, "lucia_test");
    assert.equal(s.birth_date, "2001-02-03");
    assert.equal(s.completed, false);

    await rejects(call(u, "onboarding_complete"), "interests_required");
    await call(u, "onboarding_save", {
      step: 8,
      data: { interests: ["apps"], stage: "building", seeking: ["collaboration"], skills: ["diseño"],
              project: { title: "Mi app", description: "Una app", url: "https://example.com" } },
    });
    const done = await call(u, "onboarding_complete");
    assert.equal(done.completed, true);
    assert.ok(done.project_id, "optional project created");
    const again = await call(u, "onboarding_complete");
    assert.equal(again.already, true);

    const groups = await call(u, "list_groups");
    assert.ok(groups.mine.some((g: any) => g.is_official), "joined official community");
  });

  test("username uniqueness and format", async () => {
    const a = await newUser();
    const b = await newUser();
    await call(a, "onboarding_save", { step: 1, data: { username: "unico_nombre" } });
    await rejects(call(b, "onboarding_save", { step: 1, data: { username: "Unico_Nombre" } }), "username_taken");
    await rejects(call(b, "onboarding_save", { step: 1, data: { username: "a b" } }), "username_invalid");
    assert.equal((await call(b, "username_available", { username: "unico_nombre" })).available, false);
  });

  test("birth dates are private", async () => {
    const a = await member("priv");
    const b = await member("viewer");
    const rows = await asUser(b, "select * from public.profile_private where user_id = $1", [a]);
    assert.equal(rows.length, 0);
    const prof = await call(b, "get_profile", { id: a });
    assert.equal(JSON.stringify(prof).includes("2000-05-01"), false);
    const own = await asUser(a, "select birth_date from public.profile_private where user_id = $1", [a]);
    assert.equal(own.length, 1);
  });

  test("eligibility policy is configurable (min_age)", async () => {
    await pool.query(`update app_config set value = jsonb_set(value, '{min_age}', '16') where key = 'eligibility'`);
    try {
      const u = await newUser();
      const young = new Date();
      young.setFullYear(young.getFullYear() - 14);
      await rejects(call(u, "onboarding_save", { step: 3, data: { birth_date: young.toISOString().slice(0, 10) } }), "ineligible_age");
    } finally {
      await pool.query(`update app_config set value = jsonb_set(value, '{min_age}', 'null') where key = 'eligibility'`);
    }
  });

  test("members-only functions require completed onboarding", async () => {
    const u = await newUser();
    const t = await member();
    await rejects(call(u, "swipe", { target_id: t, direction: "connect" }), "onboarding_required");
  });
});

describe("matching", () => {
  test("mutual connect creates exactly one connection and one conversation", async () => {
    const a = await member("a");
    const b = await member("b");
    const r1 = await call(a, "swipe", { target_id: b, direction: "connect" });
    assert.equal(r1.matched, false);
    const r2 = await call(b, "swipe", { target_id: a, direction: "connect" });
    assert.equal(r2.matched, true);
    assert.ok(r2.conversation_id);
    // Retrying is idempotent.
    const r3 = await call(b, "swipe", { target_id: a, direction: "connect" });
    assert.equal(r3.status, "duplicate");
    assert.equal(r3.conversation_id, r2.conversation_id);
    const convs = await pool.query(
      "select count(*)::int n from conversations where kind='direct' and user_a = least($1::uuid,$2::uuid) and user_b = greatest($1::uuid,$2::uuid)", [a, b]);
    assert.equal(convs.rows[0].n, 1);
    const cons = await pool.query("select count(*)::int n from connections where user_a = least($1::uuid,$2::uuid) and user_b = greatest($1::uuid,$2::uuid)", [a, b]);
    assert.equal(cons.rows[0].n, 1);
  });

  test("simultaneous mutual connects still produce one conversation", async () => {
    for (let i = 0; i < 5; i++) {
      const a = await member();
      const b = await member();
      const res = await Promise.all([
        call(a, "swipe", { target_id: b, direction: "connect" }),
        call(b, "swipe", { target_id: a, direction: "connect" }),
      ]);
      const convs = await pool.query(
        "select count(*)::int n from conversations where kind='direct' and user_a = least($1::uuid,$2::uuid) and user_b = greatest($1::uuid,$2::uuid)", [a, b]);
      assert.equal(convs.rows[0].n, 1);
      assert.ok(res.some((r) => r.matched), "at least one side sees the match");
    }
  });

  test("passing does not match and swiped profiles leave the feed", async () => {
    const a = await member();
    const b = await member();
    await call(a, "swipe", { target_id: b, direction: "pass" });
    await call(b, "swipe", { target_id: a, direction: "connect" });
    const feed = await call(a, "discover_feed", { limit: 30 });
    assert.equal(feed.profiles.some((p: any) => p.id === b), false);
    const cons = await pool.query("select count(*)::int n from connections where user_a = least($1::uuid,$2::uuid) and user_b = greatest($1::uuid,$2::uuid)", [a, b]);
    assert.equal(cons.rows[0].n, 0);
  });

  test("discover explains matches from real profile data", async () => {
    const a = await member("x", { interests: ["apps", "diseño"], skills: ["código"] });
    await member("y", { interests: ["diseño", "música"], skills: ["edición de vídeo"] });
    const feed = await call(a, "discover_feed", { limit: 30 });
    const withShared = feed.profiles.find((p: any) => p.shared_interests.includes("diseño"));
    assert.ok(withShared, "shared interest is reported");
  });
});

describe("daily connect allowance", () => {
  test("20 connects per day, passes are free, duplicates do not consume", async () => {
    const me = await member("limit");
    const targets: string[] = [];
    for (let i = 0; i < 23; i++) targets.push(await member());
    for (let i = 0; i < 20; i++) await call(me, "swipe", { target_id: targets[i], direction: "connect" });
    // Duplicate of an earlier connect: no extra allowance used, no error.
    const dup = await call(me, "swipe", { target_id: targets[0], direction: "connect" });
    assert.equal(dup.status, "duplicate");
    await rejects(call(me, "swipe", { target_id: targets[20], direction: "connect" }), "allowance_exhausted");
    const pass = await call(me, "swipe", { target_id: targets[21], direction: "pass" });
    assert.equal(pass.status, "ok");
    const a = await call(me, "connect_allowance");
    assert.equal(a.remaining, 0);
    assert.equal(a.limit, 20);
    assert.equal(a.timezone, "Europe/Madrid");
    assert.ok(new Date(a.resets_at) > new Date());
  });

  test("parallel requests from several devices cannot exceed the limit", async () => {
    const me = await member("devices");
    const targets: string[] = [];
    for (let i = 0; i < 26; i++) targets.push(await member());
    const results = await Promise.allSettled(targets.map((t) => call(me, "swipe", { target_id: t, direction: "connect" })));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const exhausted = results.filter((r) => r.status === "rejected" && /allowance_exhausted/.test(String((r as any).reason?.message))).length;
    assert.equal(ok, 20);
    assert.equal(exhausted, 6);
  });

  test("limit is configurable", async () => {
    await pool.query(`update app_config set value = '2' where key = 'daily_connect_limit'`);
    try {
      const me = await member();
      const t = [await member(), await member(), await member()];
      await call(me, "swipe", { target_id: t[0], direction: "connect" });
      await call(me, "swipe", { target_id: t[1], direction: "connect" });
      await rejects(call(me, "swipe", { target_id: t[2], direction: "connect" }), "allowance_exhausted");
    } finally {
      await pool.query(`update app_config set value = '20' where key = 'daily_connect_limit'`);
    }
  });
});

describe("private messages", () => {
  async function connected() {
    const a = await member();
    const b = await member();
    await call(a, "swipe", { target_id: b, direction: "connect" });
    const r = await call(b, "swipe", { target_id: a, direction: "connect" });
    return { a, b, conv: r.conversation_id as string };
  }
  const cid = () => crypto.randomUUID();

  test("connected users can message; send is idempotent", async () => {
    const { a, b, conv } = await connected();
    const client_id = cid();
    const m1 = await call(a, "send_message", { conversation_id: conv, client_id, body: "Hola!" });
    const m2 = await call(a, "send_message", { conversation_id: conv, client_id, body: "Hola!" });
    assert.equal(m1.id, m2.id);
    const msgs = await call(b, "get_messages", { conversation_id: conv });
    assert.equal(msgs.length, 1);
    const list = await call(b, "list_conversations");
    assert.equal(list.find((c: any) => c.id === conv).unread, 1);
    await call(b, "mark_read", { conversation_id: conv });
    const list2 = await call(b, "list_conversations");
    assert.equal(list2.find((c: any) => c.id === conv).unread, 0);
  });

  test("outsiders cannot read or send, even with the conversation id", async () => {
    const { conv } = await connected();
    const x = await member("outsider");
    await rejects(call(x, "send_message", { conversation_id: conv, client_id: cid(), body: "hey" }), "cannot_send");
    await rejects(call(x, "get_messages", { conversation_id: conv }), "not_found");
    const rows = await asUser(x, "select * from public.messages where conversation_id = $1", [conv]);
    assert.equal(rows.length, 0);
  });

  test("direct table writes are denied", async () => {
    const { a, conv } = await connected();
    await rejects(asUser(a, "insert into public.messages (conversation_id, sender_id, client_id, body) values ($1, $2, gen_random_uuid(), 'x')", [conv, a]),
      "permission denied");
    await rejects(asUser(a, "update public.profiles set display_name = 'hack' where id = $1", [a]), "permission denied");
  });

  test("sharing a group does not allow unsolicited DMs", async () => {
    const a = await member();
    const b = await member();
    // Both are in the official community, but have no direct conversation and cannot create one.
    const convs = await asUser(a, "select * from public.conversations where kind = 'direct' and $1::uuid in (user_a, user_b)", [b]);
    assert.equal(convs.length, 0);
  });

  test("removing a connection or blocking stops sending", async () => {
    const { a, b, conv } = await connected();
    await call(a, "remove_connection", { user_id: b });
    await rejects(call(b, "send_message", { conversation_id: conv, client_id: cid(), body: "?" }), "cannot_send");

    const p = await connected();
    await call(p.a, "block_user", { user_id: p.b });
    await rejects(call(p.b, "send_message", { conversation_id: p.conv, client_id: cid(), body: "?" }), "cannot_send");
    await rejects(call(p.a, "send_message", { conversation_id: p.conv, client_id: cid(), body: "?" }), "cannot_send");
  });

  test("connection requests: accept grants the same mutual connection", async () => {
    const a = await member();
    const b = await member();
    const r = await call(a, "send_connection_request", { user_id: b, message: "Hola" });
    assert.equal(r.status, "request_sent");
    await rejects(call(a, "send_message", { conversation_id: crypto.randomUUID(), client_id: cid(), body: "x" }), "cannot_send");
    const inbox = await call(b, "list_connection_requests");
    assert.equal(inbox.incoming.length, 1);
    const acc = await call(b, "respond_connection_request", { request_id: r.request_id, accept: true });
    assert.equal(acc.status, "connected");
    await call(a, "send_message", { conversation_id: acc.conversation_id, client_id: cid(), body: "¡Gracias!" });
  });

  test("attachments must be inside the conversation folder with an allowed type", async () => {
    const { a, conv } = await connected();
    await rejects(call(a, "send_message", { conversation_id: conv, client_id: cid(),
      attachment: { path: `other/${a}/x.png`, mime: "image/png", size: 100 } }), "invalid_attachment");
    await rejects(call(a, "send_message", { conversation_id: conv, client_id: cid(),
      attachment: { path: `${conv}/${a}/x.exe`, mime: "application/x-msdownload", size: 100 } }), "attachment_type_not_allowed");
    const ok = await call(a, "send_message", { conversation_id: conv, client_id: cid(),
      attachment: { path: `${conv}/${a}/nota.webm`, mime: "audio/webm", size: 2000, duration: 4.2 } });
    assert.equal(ok.attachment.kind, "audio");
  });

  test("message rate limit", async () => {
    const { a, conv } = await connected();
    await pool.query(`update app_config set value = '3' where key = 'messages_per_minute'`);
    try {
      for (let i = 0; i < 3; i++) await call(a, "send_message", { conversation_id: conv, client_id: cid(), body: `m${i}` });
      await rejects(call(a, "send_message", { conversation_id: conv, client_id: cid(), body: "spam" }), "rate_limited");
    } finally {
      await pool.query(`update app_config set value = '30' where key = 'messages_per_minute'`);
    }
  });
});

describe("groups", () => {
  test("public open groups can be joined; private groups need an accepted invitation", async () => {
    const owner = await member("owner");
    const x = await member();
    const pub = await call(owner, "create_group", { name: "Editores de vídeo", visibility: "public", join_policy: "open" });
    assert.equal((await call(x, "join_group", { group_id: pub.id })).status, "member");

    const priv = await call(owner, "create_group", { name: "Grupo secreto", visibility: "private" });
    await rejects(call(x, "get_group", { id: priv.id }), "not_found");
    const listed = await call(x, "list_groups");
    assert.equal(listed.discover.some((g: any) => g.id === priv.id), false);
    await rejects(call(x, "join_group", { group_id: priv.id }), "not_found");

    const inv = await call(owner, "invite_to_group", { group_id: priv.id, user_id: x });
    // Invitation alone does not make them a member.
    assert.equal((await call(x, "get_group", { id: priv.id })).my_role, null);
    await call(x, "respond_invitation", { invitation_id: inv.invitation_id, accept: true });
    assert.equal((await call(x, "get_group", { id: priv.id })).my_role, "member");
  });

  test("request-to-join groups need approval by a moderator", async () => {
    const owner = await member();
    const x = await member();
    const g = await call(owner, "create_group", { name: "Con solicitud", visibility: "public", join_policy: "request" });
    const r = await call(x, "join_group", { group_id: g.id });
    assert.equal(r.status, "requested");
    await rejects(call(x, "respond_join_request", { request_id: r.request_id, approve: true }), "forbidden");
    await call(owner, "respond_join_request", { request_id: r.request_id, approve: true });
    assert.equal((await call(x, "get_group", { id: g.id })).my_role, "member");
  });

  test("group chat is private to members; discovery exposes no messages", async () => {
    const owner = await member();
    const x = await member();
    const g = await call(owner, "create_group", { name: "Chat privado", visibility: "public", join_policy: "request" });
    const full = await call(owner, "get_group", { id: g.id });
    await call(owner, "send_message", { conversation_id: full.conversation_id, client_id: crypto.randomUUID(), body: "solo miembros" });
    const asOutsider = await call(x, "get_group", { id: g.id });
    assert.equal(asOutsider.conversation_id, null);
    await rejects(call(x, "get_messages", { conversation_id: full.conversation_id }), "not_found");
    const rows = await asUser(x, "select * from public.messages where conversation_id = $1", [full.conversation_id]);
    assert.equal(rows.length, 0);
    assert.equal(JSON.stringify(await call(x, "list_groups")).includes("solo miembros"), false);
  });

  test("40-member cap is enforced, including concurrent joins", async () => {
    const owner = await member("cap");
    const g = await call(owner, "create_group", { name: "Grupo con tope", visibility: "public", join_policy: "open" });
    const people: string[] = [];
    for (let i = 0; i < 45; i++) people.push(await member());
    const results = await Promise.allSettled(people.map((p) => call(p, "join_group", { group_id: g.id })));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    assert.equal(ok, 39, "owner + 39 = 40");
    assert.ok(results.some((r) => r.status === "rejected" && /group_full/.test(String((r as any).reason?.message))));
    const count = await pool.query("select count(*)::int n from group_members where group_id = $1", [g.id]);
    assert.equal(count.rows[0].n, 40);
    // Backstop trigger also stops direct inserts.
    await rejects(pool.query("insert into group_members (group_id, user_id) values ($1, $2)", [g.id, people[44]]), "group_full");
  });

  test("official community has no cap and cannot be left", async () => {
    const official = await pool.query("select id from groups where is_official");
    const count = await pool.query("select count(*)::int n from group_members where group_id = $1", [official.rows[0].id]);
    assert.ok(count.rows[0].n > 40, `official has ${count.rows[0].n} members`);
    const u = await member();
    await rejects(call(u, "leave_group", { group_id: official.rows[0].id }), "cannot_leave_official");
  });

  test("ownership passes to a moderator, then the oldest member; empty groups archive", async () => {
    const owner = await member();
    const m1 = await member();
    const m2 = await member();
    const g = await call(owner, "create_group", { name: "Herencia", visibility: "public", join_policy: "open" });
    await call(m1, "join_group", { group_id: g.id });
    await call(m2, "join_group", { group_id: g.id });
    await call(owner, "set_member_role", { group_id: g.id, user_id: m2, role: "moderator" });
    const left = await call(owner, "leave_group", { group_id: g.id });
    assert.equal(left.new_owner, m2);
    assert.equal((await call(m2, "get_group", { id: g.id })).my_role, "owner");
    await call(m2, "leave_group", { group_id: g.id });
    assert.equal((await call(m1, "get_group", { id: g.id })).my_role, "owner");
    await call(m1, "leave_group", { group_id: g.id });
    const arch = await pool.query("select archived_at from groups where id = $1", [g.id]);
    assert.ok(arch.rows[0].archived_at);
  });

  test("moderation permissions", async () => {
    const owner = await member();
    const mod = await member();
    const m = await member();
    const g = await call(owner, "create_group", { name: "Moderación", visibility: "public", join_policy: "open" });
    await call(mod, "join_group", { group_id: g.id });
    await call(m, "join_group", { group_id: g.id });
    await rejects(call(m, "remove_group_member", { group_id: g.id, user_id: mod }), "forbidden");
    await call(owner, "set_member_role", { group_id: g.id, user_id: mod, role: "moderator" });
    await rejects(call(mod, "remove_group_member", { group_id: g.id, user_id: owner }), "forbidden");
    await call(mod, "remove_group_member", { group_id: g.id, user_id: m });
    assert.equal((await call(m, "get_group", { id: g.id })).my_role, null);
  });

  test("sessions with RSVP are visible to members only", async () => {
    const owner = await member();
    const x = await member();
    const g = await call(owner, "create_group", { name: "Sesiones", visibility: "public", join_policy: "request" });
    const start = new Date(Date.now() + 86400000).toISOString();
    const s = await call(owner, "create_session", { group_id: g.id, title: "Revisión de portfolios", starts_at: start, meeting_url: "https://meet.example.com/abc" });
    await rejects(call(x, "rsvp_session", { session_id: s.id, status: "going" }), "not_found");
    const listed = await call(owner, "list_sessions", { group_id: g.id });
    assert.equal(listed[0].going, 1);
  });
});

describe("projects and ranking", () => {
  test("only owners edit/delete projects; shares do not duplicate", async () => {
    const owner = await member();
    const other = await member();
    const pj = await call(owner, "create_project", { title: "Canal faceless", category: "faceless",
      links: [{ label: "YouTube", url: "https://youtube.com/@x" }], feedback_kind: "review_video" });
    await rejects(call(other, "update_project", { project_id: pj.id, title: "Mío" }), "forbidden");
    await rejects(call(other, "delete_project", { project_id: pj.id }), "forbidden");
    await rejects(call(owner, "update_project", { project_id: pj.id, links: [{ url: "javascript:alert(1)" }] }), "invalid_url");
    const upd = await call(owner, "update_project", { project_id: pj.id, stage: "launched" });
    assert.equal(upd.stage, "launched");

    const g = await call(owner, "create_group", { name: "Compartir", visibility: "public", join_policy: "open" });
    await call(owner, "share_project_to_group", { project_id: pj.id, group_id: g.id });
    await call(owner, "share_project_to_group", { project_id: pj.id, group_id: g.id });
    const count = await pool.query("select count(*)::int n from projects where owner_id = $1", [owner]);
    assert.equal(count.rows[0].n, 1);
    assert.equal((await call(owner, "list_group_projects", { group_id: g.id })).length, 1);
    await call(owner, "delete_project", { project_id: pj.id });
  });

  test("comments: author edits, owner marks useful (not own), points are capped", async () => {
    const owner = await member();
    const helper = await member();
    const pj = await call(owner, "create_project", { title: "Diseño de app" });
    const c = await call(helper, "add_comment", { project_id: pj.id, body: "Probaría a aumentar el contraste del botón." });
    await rejects(call(owner, "edit_comment", { comment_id: c.id, body: "editado" }), "forbidden");
    await rejects(call(helper, "mark_useful", { comment_id: c.id }), "forbidden");
    const own = await call(owner, "add_comment", { project_id: pj.id, body: "Gracias" });
    await rejects(call(owner, "mark_useful", { comment_id: own.id }), "cannot_mark_own");
    const mk = await call(owner, "mark_useful", { comment_id: c.id });
    assert.equal(mk.points_awarded, true);
    // Re-marking does not double count.
    await call(owner, "mark_useful", { comment_id: c.id });
    const pts = await pool.query("select coalesce(sum(points),0)::int s from points_ledger where user_id = $1", [helper]);
    assert.equal(pts.rows[0].s, 10);

    // Weekly cap per pair (3): further marks from the same owner award nothing.
    for (let i = 0; i < 4; i++) {
      const ci = await call(helper, "add_comment", { project_id: pj.id, body: `Idea ${i}` });
      await call(owner, "mark_useful", { comment_id: ci.id });
    }
    const pts2 = await pool.query("select coalesce(sum(points),0)::int s from points_ledger where user_id = $1", [helper]);
    assert.equal(pts2.rows[0].s, 30);

    // Un-marking removes the points.
    await call(owner, "mark_useful", { comment_id: c.id, useful: false });
    const pts3 = await pool.query("select coalesce(sum(points),0)::int s from points_ledger where user_id = $1", [helper]);
    assert.equal(pts3.rows[0].s, 20);
  });

  test("project updates score only when substantive and within caps", async () => {
    const owner = await member();
    const pj = await call(owner, "create_project", { title: "Web portfolio" });
    const short = await call(owner, "add_project_update", { project_id: pj.id, body: "ok" });
    assert.equal(short.points_awarded, false);
    const good = await call(owner, "add_project_update", { project_id: pj.id, body: "Hoy terminé la página de proyectos y añadí el formulario de contacto." });
    assert.equal(good.points_awarded, true);
    const again = await call(owner, "add_project_update", { project_id: pj.id, body: "Otra actualización larga sobre el mismo proyecto el mismo día." });
    assert.equal(again.points_awarded, false, "one scored update per project per day");
    const r = await call(owner, "ranking", { period: "week" });
    assert.equal(r.me.points, 3);
    assert.ok(r.rules.useful_feedback_points);
  });
});

describe("blocking and reporting", () => {
  test("blocked users disappear from discover, search, profiles and the creator table", async () => {
    const a = await member("blocker");
    const b = await member("blocked");
    const bp = await call(b, "me");
    await call(a, "block_user", { user_id: b });
    const feed = await call(a, "discover_feed", { limit: 30 });
    assert.equal(feed.profiles.some((p: any) => p.id === b), false);
    assert.equal((await call(a, "search_users", { q: bp.username })).length, 0);
    await rejects(call(b, "get_profile", { id: a }), "not_found");
    assert.equal((await call(b, "creator_table", { limit: 40 })).some((p: any) => p.id === a), false);
    await rejects(call(b, "send_connection_request", { user_id: a }), "not_found");
  });

  test("reports need a visible target and are not duplicated", async () => {
    const a = await member();
    const b = await member();
    await call(a, "report", { target_type: "user", target_id: b, reason: "spam" });
    await call(a, "report", { target_type: "user", target_id: b, reason: "harassment", details: "más info" });
    const rows = await pool.query("select reason from reports where reporter_id = $1", [a]);
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].reason, "harassment");
    await rejects(call(a, "report", { target_type: "message", target_id: crypto.randomUUID(), reason: "spam" }), "not_found");
    const other = await asUser(b, "select * from public.reports");
    assert.equal(other.length, 0, "reports are visible only to their reporter");
  });
});

describe("access", () => {
  test("anonymous callers cannot execute API functions", async () => {
    await rejects(call(null, "discover_feed"), "permission denied");
  });
});

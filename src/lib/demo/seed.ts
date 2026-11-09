/**
 * Fictional demo content. Every person here is invented; avatars are generated illustrations.
 * Seeded through the same API functions as real users, so all rules apply.
 */
import type { PGlite } from "@electric-sql/pglite";

export const DEMO_EMAIL_DOMAIN = "demo.movo.invalid";

type AsUser = <T>(uid: string, fn: string, args?: Record<string, unknown>) => Promise<T>;

interface Person {
  name: string;
  username: string;
  headline: string;
  bio: string;
  interests: string[];
  stage: "exploring" | "starting" | "building";
  seeking: string[];
  skills: string[];
  birth: string;
  project?: { title: string; description: string; category: string; stage: string; help?: string; feedback?: string; url?: string };
}

const PEOPLE: Person[] = [
  { name: "Lucía Ferrer", username: "luciaferrer", headline: "Creando una app", bio: "Estudio diseño y estoy montando mi primera app para organizar pisos compartidos.", interests: ["apps", "diseno"], stage: "building", seeking: ["collaboration", "feedback"], skills: ["diseño ui", "figma"], birth: "2003-04-12",
    project: { title: "Piso Fácil", description: "Una app para repartir gastos y tareas en pisos compartidos sin discusiones.", category: "app", stage: "building", help: "Busco a alguien que sepa React Native.", feedback: "test_app", url: "https://example.com/pisofacil" } },
  { name: "Mateo Ríos", username: "mateorios", headline: "Busca editor", bio: "Hago vídeos de ciencia curiosa. Necesito alguien con ritmo para editar.", interests: ["youtube", "edicion"], stage: "building", seeking: ["collaboration"], skills: ["guiones", "locución"], birth: "2001-09-30",
    project: { title: "Ciencia en 60s", description: "Canal de divulgación con vídeos cortos que explican cosas cotidianas.", category: "youtube", stage: "launched", help: "Edición dinámica para Shorts.", feedback: "review_video" } },
  { name: "Valentina Cruz", username: "valecruz", headline: "Diseñadora de marca", bio: "Me encanta crear identidades visuales para proyectos que empiezan.", interests: ["diseno", "ilustracion"], stage: "starting", seeking: ["people", "feedback"], skills: ["branding", "ilustración"], birth: "2002-01-18" },
  { name: "Hugo Navarro", username: "hugonav", headline: "Canal faceless de historia", bio: "Historias de la antigüedad narradas con IA y mucho cariño en el montaje.", interests: ["faceless", "youtube", "ia-creativa"], stage: "building", seeking: ["feedback", "learning"], skills: ["investigación", "davinci resolve"], birth: "2000-06-02",
    project: { title: "Crónicas Antiguas", description: "Canal faceless sobre civilizaciones antiguas con narración y mapas animados.", category: "faceless", stage: "building", help: "Opiniones sobre miniaturas.", feedback: "review_video" } },
  { name: "Sofía Medina", username: "sofimedina", headline: "Aprendiendo a programar", bio: "Empecé con HTML hace dos meses y ya quiero hacer mi primera web.", interests: ["webs", "programacion"], stage: "starting", seeking: ["learning", "people"], skills: ["redacción"], birth: "2004-11-05" },
  { name: "Daniel Ortega", username: "danortega", headline: "Dev web freelance", bio: "Hago webs rápidas con Next.js. Me gusta ayudar a quien empieza.", interests: ["webs", "programacion", "apps"], stage: "building", seeking: ["collaboration", "people"], skills: ["next.js", "react", "seo"], birth: "1999-03-21",
    project: { title: "Plantillas Rápidas", description: "Plantillas web gratuitas para creadores que quieren su página en una tarde.", category: "web", stage: "launched", feedback: "rate_design", url: "https://example.com/plantillas" } },
  { name: "Martina Gil", username: "martinagil", headline: "Explorando ideas", bio: "Me gustan los podcasts y la fotografía. Aún no sé por dónde empezar.", interests: ["podcasts", "fotografia"], stage: "exploring", seeking: ["people", "learning"], skills: ["fotografía"], birth: "2003-08-14" },
  { name: "Leo Castillo", username: "leocastillo", headline: "Motion designer", bio: "Animo logos, títulos y transiciones. After Effects es mi casa.", interests: ["edicion", "diseno", "3d"], stage: "building", seeking: ["collaboration"], skills: ["after effects", "motion graphics"], birth: "2000-12-09" },
  { name: "Irene Soler", username: "irenesoler", headline: "Busca cofundador técnico", bio: "Tengo una idea para una app de hábitos para estudiantes y busco equipo.", interests: ["apps", "redes-sociales"], stage: "starting", seeking: ["collaboration", "feedback"], skills: ["marketing", "notion"], birth: "2002-05-27",
    project: { title: "Hábito Diario", description: "App de hábitos pensada para estudiantes, con retos semanales en grupo.", category: "app", stage: "idea", help: "Busco cofundador/a técnico.", feedback: "seek_collab" } },
  { name: "Adrián Vega", username: "adrianvega", headline: "Productor musical", bio: "Hago beats y música para vídeos. Siempre abierto a colaborar.", interests: ["musica", "youtube"], stage: "building", seeking: ["collaboration", "people"], skills: ["producción musical", "mezcla"], birth: "2001-02-11" },
  { name: "Paula Romero", username: "paularomero", headline: "Editora de Reels", bio: "Edito vídeos cortos para marcas pequeñas. Quiero aprender color.", interests: ["edicion", "redes-sociales"], stage: "building", seeking: ["learning", "feedback"], skills: ["capcut", "premiere"], birth: "2003-10-03" },
  { name: "Nico Herrera", username: "nicoherrera", headline: "Hace videojuegos indie", bio: "Desarrollo un juego de puzles en mis ratos libres. Godot fan.", interests: ["videojuegos", "programacion"], stage: "building", seeking: ["feedback", "collaboration"], skills: ["godot", "pixel art"], birth: "2000-07-16",
    project: { title: "Luz Perdida", description: "Juego de puzles con luces y sombras. Demo jugable en navegador.", category: "otro", stage: "building", help: "Testers para la primera demo.", feedback: "test_app" } },
  { name: "Carla Méndez", username: "carlamendez", headline: "Escribe guiones", bio: "Guionista en formación. Me encanta contar historias en vídeo.", interests: ["escritura", "youtube"], stage: "starting", seeking: ["collaboration", "learning"], skills: ["guiones", "storytelling"], birth: "2002-03-08" },
  { name: "Javier Luna", username: "javiluna", headline: "Fotógrafo urbano", bio: "Saco fotos de ciudad y quiero montar mi portfolio online.", interests: ["fotografia", "webs"], stage: "starting", seeking: ["feedback", "people"], skills: ["fotografía", "lightroom"], birth: "1998-12-22" },
  { name: "Alba Prieto", username: "albaprieto", headline: "UX research", bio: "Me fascina entender cómo usa la gente las apps. Hago tests de usabilidad.", interests: ["apps", "diseno"], stage: "building", seeking: ["people", "collaboration"], skills: ["ux research", "tests de usuario"], birth: "1999-09-01" },
  { name: "Samuel Ibáñez", username: "samibanez", headline: "Aprendiendo IA creativa", bio: "Experimento con herramientas de IA para vídeo y música.", interests: ["ia-creativa", "musica"], stage: "exploring", seeking: ["learning", "people"], skills: ["prompting"], birth: "2004-02-19" },
  { name: "Noa Delgado", username: "noadelgado", headline: "Ilustradora", bio: "Dibujo personajes y hago stickers. Quiero lanzar una tienda online.", interests: ["ilustracion", "diseno"], stage: "starting", seeking: ["feedback", "learning"], skills: ["ilustración", "procreate"], birth: "2003-06-25" },
  { name: "Bruno Campos", username: "brunocampos", headline: "Streamer y editor", bio: "Hago directos de juegos y edito los mejores momentos.", interests: ["videojuegos", "edicion", "youtube"], stage: "building", seeking: ["people", "collaboration"], skills: ["obs", "edición"], birth: "2001-11-30" },
  { name: "Elena Ruiz", username: "elenaruiz", headline: "Newsletter de diseño", bio: "Escribo cada semana sobre diseño y creatividad.", interests: ["escritura", "diseno"], stage: "building", seeking: ["feedback", "people"], skills: ["redacción", "newsletters"], birth: "1997-04-04",
    project: { title: "Pixel y Papel", description: "Newsletter semanal con recursos de diseño para gente que empieza.", category: "escritura", stage: "launched", feedback: "rate_design" } },
  { name: "Iker Santos", username: "ikersantos", headline: "Construye su primera web", bio: "Quiero hacer una web para el club de baloncesto de mi barrio.", interests: ["webs"], stage: "starting", seeking: ["learning", "feedback"], skills: ["fotografía deportiva"], birth: "2005-01-15" },
  { name: "Aitana Vidal", username: "aitanavidal", headline: "Social media", bio: "Gestiono redes para pequeños negocios y quiero crear mi propia marca.", interests: ["redes-sociales", "fotografia"], stage: "building", seeking: ["people", "collaboration"], skills: ["estrategia de contenido", "copy"], birth: "2000-10-10" },
  { name: "Marco Pineda", username: "marcopineda", headline: "Animación 3D", bio: "Modelo y animo en Blender. Me encantaría colaborar en un corto.", interests: ["3d", "edicion"], stage: "building", seeking: ["collaboration", "feedback"], skills: ["blender", "modelado 3d"], birth: "1999-08-18" },
  { name: "Julia Reyes", username: "juliareyes", headline: "Podcast sobre emprender", bio: "Entrevisto a gente joven que ha empezado algo propio.", interests: ["podcasts", "escritura"], stage: "building", seeking: ["people", "feedback"], skills: ["entrevistas", "edición de audio"], birth: "1998-05-05",
    project: { title: "Empezar Joven", description: "Podcast de entrevistas a personas que crearon algo antes de los 25.", category: "otro", stage: "launched", help: "Ideas de invitados.", feedback: "review_video" } },
  { name: "Omar Haddad", username: "omarhaddad", headline: "Explorando el no-code", bio: "Monto prototipos con herramientas no-code y quiero lanzar algo pronto.", interests: ["apps", "ia-creativa"], stage: "exploring", seeking: ["learning", "collaboration"], skills: ["no-code", "automatizaciones"], birth: "2002-07-07" },
];

const GROUPS = [
  { owner: "danortega", name: "Webs desde cero", topic: "webs", description: "Para quien quiere hacer su primera web: dudas, recursos y revisiones.", join_policy: "open",
    members: ["sofimedina", "javiluna", "ikersantos", "omarhaddad"], rules: "Pregunta sin miedo. Comparte el enlace cuando pidas revisión." },
  { owner: "mateorios", name: "Edición y ritmo", topic: "edicion", description: "Editores de vídeo compartiendo trucos, plantillas y feedback de cortes.", join_policy: "open",
    members: ["paularomero", "leocastillo", "brunocampos", "hugonav"], rules: "Comparte el vídeo con contexto: qué querías conseguir." },
  { owner: "luciaferrer", name: "Apps en marcha", topic: "apps", description: "Gente construyendo apps: avances semanales y pruebas cruzadas.", join_policy: "request",
    members: ["albaprieto", "irenesoler", "nicoherrera"], rules: "Cada lunes, comparte un avance." },
  { owner: "hugonav", name: "Faceless lab", topic: "faceless", description: "Canales sin cara: guiones, voces, miniaturas y métricas reales.", join_policy: "open",
    members: ["samibanez", "carlamendez"], rules: "Nada de prometer dinero fácil." },
  { owner: "valecruz", name: "Club de ilustración", topic: "diseno", description: "Dibujamos juntos un tema distinto cada semana.", join_policy: "open",
    members: ["noadelgado", "elenaruiz", "marcopineda"], rules: "Feedback amable y concreto." },
];

const GROUP_CHATS: Record<string, [string, string][]> = {
  "Comunidad Movo": [
    ["danortega", "¡Bienvenidos a quienes acabáis de llegar! Contad en qué estáis 👋"],
    ["sofimedina", "Hola! Estoy aprendiendo a hacer webs, si alguien quiere practicar juntos me apunto."],
    ["mateorios", "Busco editor para Shorts de ciencia. Si os interesa, mirad mi perfil 🙌"],
    ["valecruz", "Esta semana en el Club de ilustración el tema es 'mi barrio'."],
  ],
  "Webs desde cero": [
    ["danortega", "Reto de la semana: publicar una página con vuestro nombre y tres proyectos."],
    ["sofimedina", "¿Recomendáis empezar con HTML a pelo o con un framework?"],
    ["danortega", "HTML y CSS primero. Cuando te aburras de copiar el menú en cada página, framework."],
  ],
  "Edición y ritmo": [
    ["paularomero", "¿Cómo hacéis las transiciones de zoom sin que maree?"],
    ["leocastillo", "Easing suave y que dure menos de 8 frames. Os paso un preset en recursos."],
  ],
};

const COMMENTS: [string, string, string][] = [
  ["Piso Fácil", "albaprieto", "Probé el prototipo: el botón de añadir gasto se pierde. Lo pondría fijo abajo."],
  ["Piso Fácil", "danortega", "Para React Native te recomiendo Expo; puedo ayudarte con la configuración inicial."],
  ["Ciencia en 60s", "paularomero", "El gancho de los primeros 2 segundos funciona muy bien. Recortaría la intro del logo."],
  ["Crónicas Antiguas", "carlamendez", "Las miniaturas con un solo rostro y texto corto suelen funcionar mejor que los mapas."],
  ["Plantillas Rápidas", "valecruz", "La tipografía de los títulos es muy fina en móvil; subiría el peso."],
  ["Luz Perdida", "brunocampos", "Me pasé el nivel 3 sin entender la mecánica de los espejos; quizá un tutorial corto."],
  ["Hábito Diario", "omarhaddad", "Podrías validar la idea con un prototipo no-code antes de buscar cofundador."],
];

const UPDATES: [string, string][] = [
  ["Piso Fácil", "Terminé el flujo de añadir gastos y ya se puede dividir entre varias personas. Siguiente paso: notificaciones."],
  ["Ciencia en 60s", "Publicado el vídeo 12 sobre por qué el pan se pone duro. Probé subtítulos más grandes y la retención mejoró."],
  ["Crónicas Antiguas", "Nueva serie sobre Mesopotamia. He rehecho los mapas animados con un estilo más limpio."],
  ["Luz Perdida", "La demo ya funciona en el navegador. Añadí cinco niveles nuevos y un modo sin tiempo."],
  ["Pixel y Papel", "Número 30 enviado: recursos gratuitos para crear iconos coherentes."],
];

export function simulatedReply(previousReplies: number, lastBody: string): string {
  const greet = ["¡Hola! Qué bien que conectáramos 😊 ¿En qué andas ahora?", "¡Hey! Encantada de conectar. Vi tu perfil y me molaron tus intereses."];
  const follow = ["Suena genial. Si quieres podemos enseñarnos lo que tenemos esta semana.", "¡Me apunto! Pásame un enlace cuando lo tengas.", "Qué interesante. Yo justo estoy con algo parecido."];
  if (previousReplies === 0) return greet[lastBody.length % greet.length];
  if (/\?/.test(lastBody)) return "Buena pregunta 🤔 Ahora mismo estoy probando cosas, pero te cuento en cuanto avance.";
  return follow[(previousReplies + lastBody.length) % follow.length];
}

export async function seedDemo(db: PGlite, asUser: AsUser) {
  const ids = new Map<string, string>();
  for (const p of PEOPLE) {
    const r = await db.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [`${p.username}@${DEMO_EMAIL_DOMAIN}`]);
    const id = r.rows[0].id;
    ids.set(p.username, id);
    await asUser(id, "onboarding_save", {
      step: 8,
      data: {
        display_name: p.name, username: p.username, avatar_url: `gen:${p.username}`, birth_date: p.birth,
        interests: p.interests, stage: p.stage, seeking: p.seeking, skills: p.skills, headline: p.headline, bio: p.bio,
      },
    });
    await asUser(id, "onboarding_complete", {});
  }

  const projects = new Map<string, { id: string; owner: string }>();
  for (const p of PEOPLE) {
    if (!p.project) continue;
    const owner = ids.get(p.username)!;
    const pj = await asUser<{ id: string }>(owner, "create_project", {
      title: p.project.title, description: p.project.description, category: p.project.category, stage: p.project.stage,
      help_needed: p.project.help ?? null, feedback_kind: p.project.feedback ?? null, cover_url: `gen:${p.username}-cover`,
      links: p.project.url ? [{ label: "Web", url: p.project.url }] : [],
    });
    projects.set(p.project.title, { id: pj.id, owner });
  }

  for (const [title, body] of UPDATES) {
    const pj = projects.get(title)!;
    await asUser(pj.owner, "add_project_update", { project_id: pj.id, body });
  }

  for (const [title, author, body] of COMMENTS) {
    const pj = projects.get(title)!;
    const c = await asUser<{ id: string }>(ids.get(author)!, "add_comment", { project_id: pj.id, body });
    await asUser(pj.owner, "mark_useful", { comment_id: c.id });
  }

  const groupIds = new Map<string, string>();
  const official = await db.query<{ id: string }>("select id from public.groups where is_official");
  groupIds.set("Comunidad Movo", official.rows[0].id);
  for (const g of GROUPS) {
    const owner = ids.get(g.owner)!;
    const created = await asUser<{ id: string }>(owner, "create_group", {
      name: g.name, description: g.description, topic: g.topic, visibility: "public", join_policy: g.join_policy,
      rules: g.rules, image_url: `gen:${g.topic}-group`,
    });
    groupIds.set(g.name, created.id);
    for (const m of g.members) {
      const uid = ids.get(m);
      if (!uid) continue;
      if (g.join_policy === "open") await asUser(uid, "join_group", { group_id: created.id });
      else {
        const r = await asUser<{ request_id: string }>(uid, "join_group", { group_id: created.id });
        await asUser(owner, "respond_join_request", { request_id: r.request_id, approve: true });
      }
    }
  }
  // A private group, used to demonstrate invitations.
  const priv = await asUser<{ id: string }>(ids.get("albaprieto")!, "create_group", {
    name: "Tests de usabilidad", description: "Grupo pequeño para probar apps entre nosotros antes de lanzarlas.",
    topic: "apps", visibility: "private", rules: "Lo que se prueba aquí, se queda aquí.", image_url: "gen:ux-group",
  });
  groupIds.set("Tests de usabilidad", priv.id);
  await db.query("insert into demo.meta values ('private_group', $1)", [priv.id]);
  await db.query("insert into demo.meta values ('private_group_owner', $1)", [ids.get("albaprieto")!]);

  await asUser(projects.get("Piso Fácil")!.owner, "share_project_to_group", { project_id: projects.get("Piso Fácil")!.id, group_id: groupIds.get("Apps en marcha") });
  await asUser(projects.get("Luz Perdida")!.owner, "share_project_to_group", { project_id: projects.get("Luz Perdida")!.id, group_id: groupIds.get("Apps en marcha") });
  await asUser(projects.get("Ciencia en 60s")!.owner, "share_project_to_group", { project_id: projects.get("Ciencia en 60s")!.id, group_id: groupIds.get("Edición y ritmo") });

  for (const [groupName, lines] of Object.entries(GROUP_CHATS)) {
    const gid = groupIds.get(groupName)!;
    const conv = await db.query<{ id: string }>("select id from public.conversations where kind = 'group' and group_id = $1", [gid]);
    for (const [who, body] of lines) {
      await asUser(ids.get(who)!, "send_message", { conversation_id: conv.rows[0].id, client_id: crypto.randomUUID(), body });
    }
  }

  const day = 86400000;
  const at = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * day);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  await asUser(ids.get("danortega")!, "create_session", { group_id: groupIds.get("Webs desde cero"), title: "Revisión de webs en directo", description: "Trae tu web y la revisamos entre todos.", starts_at: at(2, 19), duration_minutes: 60, meeting_url: "https://meet.example.com/webs-desde-cero" });
  await asUser(ids.get("mateorios")!, "create_session", { group_id: groupIds.get("Edición y ritmo"), title: "Edición de Shorts: ganchos", starts_at: at(4, 18), duration_minutes: 45 });
  await asUser(ids.get("danortega")!, "create_session", { group_id: groupIds.get("Comunidad Movo"), title: "Bienvenida a nuevos miembros", description: "Presentaciones rápidas y dudas sobre Movo.", starts_at: at(1, 20), duration_minutes: 30, meeting_url: "https://meet.example.com/bienvenida" });

  // Spread seeded timestamps over the past days so the demo reads naturally.
  await db.exec(`
    update public.messages set created_at = now() - (random() * interval '3 days') where created_at > now() - interval '1 hour';
    update public.conversations c set last_message_at = (select max(created_at) from public.messages m where m.conversation_id = c.id);
    update public.project_updates set created_at = now() - (random() * interval '5 days');
    update public.project_comments set created_at = now() - (random() * interval '4 days');
    update public.profiles set created_at = now() - (random() * interval '30 days');
  `);
}

/**
 * Runs when a demo account is created (as the database owner, outside RLS).
 * Simulated: some fictional people have already chosen "Conectar" on this account; one sends a
 * connection request and one invites them to a private group.
 */
export async function onDemoAccountCreated(db: PGlite, uid: string) {
  await db.query(
    `insert into public.swipes (swiper_id, target_id, direction, local_day)
     select id, $1, 'connect', (now() at time zone 'Europe/Madrid')::date from public.profiles
      where id in (select id from auth.users where email like $2) and abs(hashtext(id::text)) % 5 < 2
     on conflict do nothing`, [uid, `%@${DEMO_EMAIL_DOMAIN}`]);
  await db.query(
    `insert into public.connection_requests (from_id, to_id, message)
     select id, $1, 'Hola! Vi que te interesan cosas parecidas, ¿conectamos?' from public.profiles where username = 'carlamendez'`, [uid]);
  await db.query(
    `insert into public.group_invitations (group_id, inviter_id, invitee_id)
     select (select value::uuid from demo.meta where key = 'private_group'), (select value::uuid from demo.meta where key = 'private_group_owner'), $1`, [uid]);
}

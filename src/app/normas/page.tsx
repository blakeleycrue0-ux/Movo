import Link from "next/link";

export const metadata = { title: "Normas de la comunidad" };

export default function Normas() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10" style={{ paddingTop: "calc(var(--safe-t) + 40px)" }}>
      <Link href="/" className="text-[14px] font-semibold text-ink-2 hover:text-ink">← Movo</Link>
      <h1 className="mt-4 text-[32px]">Normas de la comunidad</h1>
      <p className="mt-3 text-ink-2">Movo es un sitio para conocer gente con quien crear. Para que siga siendo un buen lugar:</p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-[16px]">
        <li>Trata a todo el mundo con respeto. Nada de acoso, odio ni presión.</li>
        <li>Movo es para conexiones creativas y de amistad, no para citas.</li>
        <li>Da feedback concreto, honesto y amable.</li>
        <li>Nada de spam, estafas ni promesas de dinero fácil.</li>
        <li>Protege tu privacidad: no compartas datos personales sensibles.</li>
        <li>Si algo no está bien, bloquea y reporta. Revisamos los reportes.</li>
      </ol>
      <p className="mt-8 rounded-2xl bg-sun-soft px-4 py-3 text-[14px] text-[#6b4a0f]">
        Las normas de edad y de interacción entre menores y adultos aún están pendientes de decisión. Hasta que se publiquen, Movo funciona como prueba privada.
      </p>
    </main>
  );
}

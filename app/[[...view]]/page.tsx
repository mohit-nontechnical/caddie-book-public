import { notFound } from "next/navigation";
import CaddieApp from "../components/CaddieApp";
import { isKnownSlug } from "../components/urlView";

// Optional catch-all: "/" and every known view slug (/bag, /insights,
// /rounds, /coach, ...) all serve the app, with the initial page picked
// from the URL. Unknown paths 404.
export default async function Home({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const { view } = await params;
  const slug = view?.[0] ?? "";
  if (slug && (view!.length > 1 || !isKnownSlug(slug))) notFound();
  return (
    <main className="cb-stage">
      <CaddieApp initialView={slug} />
    </main>
  );
}

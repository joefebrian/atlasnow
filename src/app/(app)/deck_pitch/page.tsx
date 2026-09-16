import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { PitchDeck } from "@/components/pitch/PitchDeck";
import { getLocale } from "@/lib/i18n/get-locale";

export const metadata = {
  title: "Pitch deck · AtlasNow",
  robots: { index: false, follow: false },
};

export default async function DeckPitchPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.isPlatformAdmin) redirect("/control-tower");
  const locale = await getLocale();
  return <PitchDeck initialLocale={locale} />;
}

import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { TrainingDeck } from "@/components/pitch/TrainingDeck";

export const metadata = {
  title: "Free training · AtlasNow",
  robots: { index: false, follow: false },
};

export default async function DeckTrainPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  return <TrainingDeck locale={locale} />;
}

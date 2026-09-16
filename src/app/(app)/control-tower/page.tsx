import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { loadHomeDesk } from "@/lib/home/desk";
import { HomeDesk } from "@/components/home/HomeDesk";

type Props = { searchParams: Promise<{ from?: string; to?: string; compare?: string }> };

export default async function ControlTowerPage({ searchParams }: Props) {
  const session = await readSession();
  const locale = await getLocale();
  const t = getMessages(locale).controlTower;
  const query = await searchParams;
  const data = await loadHomeDesk(session!, locale, query);

  return <HomeDesk t={t} data={data} isGroup={session!.isAgencyStaff} />;
}

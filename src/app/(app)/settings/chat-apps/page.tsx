import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { ChannelsPanel } from "@/components/channels/ChannelsPanel";

type Props = { searchParams: Promise<{ client?: string; meta?: string; meta_error?: string }> };

export default async function SettingsChatAppsPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const initialClientId = session.isAgencyStaff
    ? sp.client || null
    : session.tenantId;

  return (
    <ChannelsPanel isAgency={session.isAgencyStaff} initialClientId={initialClientId} />
  );
}

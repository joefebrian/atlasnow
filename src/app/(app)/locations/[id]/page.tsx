import { notFound, redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import { Location360 } from "@/components/locations/Location360";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export default async function LocationDetailPage({ params, searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const { tab } = await searchParams;
  const location = await getLocationForSession(session, id);
  if (!location) notFound();

  const initialTab =
    tab === "Reputation" || tab === "Visibility" || tab === "Timeline" || tab === "Data contract" || tab === "Overview"
      ? tab
      : undefined;

  return <Location360 location={location} initialTab={initialTab} />;
}

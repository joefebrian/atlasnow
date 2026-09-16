import { redirect } from "next/navigation";
import { requireAgencySession } from "@/lib/auth";
import { BackLink, PageHeader } from "@/components/ui";
import { ClientCreateForm } from "@/components/clients/ClientCreateForm";

export default async function NewClientPage() {
  const session = await requireAgencySession();
  if (!session) {
    redirect("/control-tower");
  }

  return (
    <div className="an-section mx-auto w-full max-w-3xl">
      <PageHeader
        back={<BackLink href="/clients">Back to brands</BackLink>}
        eyebrow="New brand"
        title="Create brand"
        description="Add a restaurant or shop. They can sign in later, after you turn on their login."
      />
      <ClientCreateForm />
    </div>
  );
}

import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({
  path: "/signup",
  title: "Create an AtlasNow account — WhatsApp CRM for multi-outlet brands",
  description:
    "Create an AtlasNow workspace with Google, Facebook, or email. No credit card. WhatsApp CRM and Google Business Profile after follow-up. You agree to the Terms and Privacy Policy when you register.",
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}

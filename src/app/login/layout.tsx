import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({
  path: "/login",
  title: "Sign in — AtlasNow",
  description: "Sign in to AtlasNow, the brand desk for every outlet.",
  index: false,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { NextResponse } from "next/server";

/**
 * Mock Google connect is retired. Use live OAuth:
 * Settings → API Configuration → Connect Google on Data Health.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Mock Google connect is disabled. Configure OAuth in Settings → API Configuration, then use Connect Google on Data Health.",
      docs: "/settings/google",
      settings: "/settings/api",
    },
    { status: 410 }
  );
}

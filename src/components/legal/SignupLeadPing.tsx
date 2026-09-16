"use client";

import { useEffect } from "react";
import { readSignupMethod, trackGenerateLead, trackSignUp } from "@/lib/analytics/ga";

const KEY = "atlasnow_lead_signup";

/** Fire sign_up + generate_lead once per tab after signup lands on pending. */
export function SignupLeadPing() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* still send once this mount */
    }
    const method = readSignupMethod();
    trackSignUp(method);
    trackGenerateLead("signup");
  }, []);
  return null;
}

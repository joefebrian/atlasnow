"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  COOKIE_CONSENT_EVENT,
  GA_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  gaAllowedHost,
  grantAdsConsent,
  hasCookieConsent,
  isGaPublicPath,
  trackPageView,
} from "@/lib/analytics/ga";

export function GoogleAnalytics() {
  const pathname = usePathname() || "/";
  const [allowed, setAllowed] = useState(false);
  const [consented, setConsented] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      if (typeof window === "undefined") return;
      const ok =
        Boolean(GA_MEASUREMENT_ID) &&
        gaAllowedHost(window.location.hostname) &&
        isGaPublicPath(pathname);
      setAllowed(ok);
      setConsented(ok && hasCookieConsent());
    }
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
  }, [pathname]);

  useEffect(() => {
    if (!allowed || !ready || !consented) return;
    grantAdsConsent();
    trackPageView(pathname);
  }, [allowed, ready, consented, pathname]);

  if (!allowed) return null;

  const adsConfig = GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : "";

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive" onReady={() => setReady(true)}>
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
gtag('set', 'ads_data_redaction', true);
gtag('set', 'url_passthrough', true);
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', {
  anonymize_ip: true,
  send_page_view: false,
  allow_google_signals: true,
  allow_ad_personalization_signals: true
});
${adsConfig}
`}
      </Script>
    </>
  );
}

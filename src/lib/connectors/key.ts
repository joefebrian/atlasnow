/** One-row providers use an empty account key. WhatsApp Cloud uses the phone number id. */
export function connectorUnique(tenantId: string, provider: string, accountKey = "") {
  return {
    tenantId_provider_accountKey: {
      tenantId,
      provider,
      accountKey,
    },
  };
}

export type PortfolioClient = { id: string; name: string; slug: string };

export type PortfolioLocation = {
  tenant: { id: string };
  readiness: string;
  phone: string | null;
  city: string | null;
};

export type ClientPortfolioSummary = {
  id: string;
  name: string;
  slug: string;
  locationCount: number;
  readyCount: number;
  mappedCount: number;
  phoneCount: number;
  cities: string[];
};

export function summarizeClientsForPortfolio(
  clients: PortfolioClient[],
  locations: PortfolioLocation[]
): ClientPortfolioSummary[] {
  return clients
    .map((c) => {
      const locs = locations.filter((l) => l.tenant.id === c.id);
      const cities = [
        ...new Set(locs.map((l) => l.city?.trim()).filter((x): x is string => Boolean(x))),
      ];
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        locationCount: locs.length,
        readyCount: locs.filter(
          (l) => l.readiness === "READY" || l.readiness === "MAPPED"
        ).length,
        mappedCount: locs.filter((l) => l.readiness === "MAPPED").length,
        phoneCount: locs.filter((l) => Boolean(l.phone?.trim())).length,
        cities,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

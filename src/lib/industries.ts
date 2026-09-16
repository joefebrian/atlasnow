/** Common industries for multi-location / local brands (AtlasNow clients). */

export const INDUSTRY_SUGGESTIONS = [
  "F&B",
  "Restaurant",
  "Cafe & Coffee",
  "Bakery & Dessert",
  "QSR / Fast food",
  "Cloud kitchen",
  "Retail",
  "Fashion & Apparel",
  "Beauty & Personal care",
  "Salon & Spa",
  "Health & Wellness",
  "Clinic & Healthcare",
  "Pharmacy",
  "Fitness & Gym",
  "Grocery & Convenience",
  "Electronics",
  "Home & Living",
  "Furniture",
  "Automotive",
  "Car dealership / Service",
  "Education",
  "Training & Courses",
  "Hospitality & Hotel",
  "Travel & Tourism",
  "Real estate",
  "Property management",
  "Banking & Finance",
  "Insurance",
  "Professional services",
  "Legal",
  "Accounting",
  "IT & Software",
  "Telecom",
  "Logistics & Delivery",
  "Warehouse",
  "Manufacturing",
  "Franchise multi-brand",
  "Entertainment",
  "Cinema & Events",
  "Pet care",
  "Agriculture",
  "Other",
] as const;

export function filterIndustrySuggestions(
  query: string,
  extra: string[] = []
): string[] {
  const q = query.trim().toLowerCase();
  const pool = Array.from(
    new Set([...INDUSTRY_SUGGESTIONS, ...extra.map((s) => s.trim()).filter(Boolean)])
  );
  if (!q) return pool.slice(0, 12);
  return pool
    .filter((item) => item.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.localeCompare(b);
    })
    .slice(0, 12);
}

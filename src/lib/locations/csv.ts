export type CsvLocationRow = {
  name: string;
  code?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  website?: string;
  timezone?: string;
  notes?: string;
};

export type CsvParseIssue = {
  row: number;
  field?: string;
  message: string;
};

export type CsvParseResult = {
  rows: CsvLocationRow[];
  issues: CsvParseIssue[];
};

/** Minimal CSV parser (quoted fields supported). First row = headers. */
export function parseLocationCsv(text: string): CsvParseResult {
  const lines = splitCsvLines(text);
  const issues: CsvParseIssue[] = [];
  if (lines.length === 0) {
    return { rows: [], issues: [{ row: 0, message: "Empty CSV" }] };
  }

  const headers = lines[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const nameIdx = headers.findIndex((h) => h === "name" || h === "location_name" || h === "store_name");
  if (nameIdx < 0) {
    return {
      rows: [],
      issues: [{ row: 1, message: "Missing required column: name" }],
    };
  }

  const col = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));

  const idxs = {
    name: nameIdx,
    code: col(["code", "store_code", "branch_code"]),
    addressLine1: col(["address", "address_line1", "address1", "street"]),
    addressLine2: col(["address_line2", "address2"]),
    city: col(["city"]),
    region: col(["region", "state", "province"]),
    postalCode: col(["postal_code", "zip", "postcode"]),
    country: col(["country"]),
    phone: col(["phone", "tel", "telephone"]),
    website: col(["website", "url"]),
    timezone: col(["timezone", "tz"]),
    notes: col(["notes", "note"]),
  };

  const rows: CsvLocationRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    if (cells.every((c) => !c.trim())) continue;
    const name = (cells[idxs.name] || "").trim();
    if (!name) {
      issues.push({ row: i + 1, field: "name", message: "Name is required" });
      continue;
    }
    if (name.length < 2) {
      issues.push({ row: i + 1, field: "name", message: "Name too short" });
      continue;
    }
    const get = (idx: number) =>
      idx >= 0 ? (cells[idx] || "").trim() || undefined : undefined;

    rows.push({
      name,
      code: get(idxs.code),
      addressLine1: get(idxs.addressLine1),
      addressLine2: get(idxs.addressLine2),
      city: get(idxs.city),
      region: get(idxs.region),
      postalCode: get(idxs.postalCode),
      country: get(idxs.country) || "ID",
      phone: get(idxs.phone),
      website: get(idxs.website),
      timezone: get(idxs.timezone) || "Asia/Jakarta",
      notes: get(idxs.notes),
    });
  }

  return { rows, issues };
}

function splitCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // trim trailing empty from \r
    if (row.length === 1 && row[0] === "" && rows.length === 0) return;
    rows.push(row);
    row = [];
  };

  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    pushCell();
    pushRow();
  }
  return rows;
}

export const CSV_TEMPLATE = `name,code,address_line1,city,region,postal_code,country,phone,website,timezone,notes
Menteng Flagship,MNT-01,"Jl. HOS Cokroaminoto 12",Jakarta,DKI Jakarta,10310,ID,+6221123456,https://example.com/menteng,Asia/Jakarta,Pilot store
Alam Sutera,ALS-01,"Ruko Alam Sutera Blok A",Tangerang,Banten,15325,ID,+62217654321,,Asia/Jakarta,
`;

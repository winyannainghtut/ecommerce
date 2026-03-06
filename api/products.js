const AIRTABLE_API_BASE = "https://api.airtable.com/v0";
const fs = require("node:fs");
const path = require("node:path");
const FIELDS = {
  name: "Name",
  price: "Price",
  photo: "Photo",
  readyToOrder: "Ready to Order",
  telegramTarget: "Telegram Target",
};

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const localEnv = readLocalEnvFallback();
  const token = process.env.AIRTABLE_TOKEN || localEnv.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || localEnv.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || localEnv.AIRTABLE_TABLE_NAME || "Products";

  if (!token || !baseId) {
    return res.status(500).json({
      error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID environment variable.",
    });
  }

  try {
    const products = await fetchProductsFromAirtable({ token, baseId, tableName });
    // Always return fresh Airtable data for catalog updates.
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({ products });
  } catch (error) {
    console.error("Airtable proxy failed:", error);
    return res.status(500).json({ error: "Failed to load products from Airtable." });
  }
};

async function fetchProductsFromAirtable({ token, baseId, tableName }) {
  const records = [];
  let offset = "";

  do {
    const params = new URLSearchParams({
      pageSize: "100",
      "sort[0][field]": FIELDS.name,
      "sort[0][direction]": "asc",
    });

    if (offset) {
      params.set("offset", offset);
    }

    const endpoint = `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableName)}?${params.toString()}`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = await readErrorBody(response);
      throw new Error(`Airtable request failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    records.push(...(payload.records || []));
    offset = payload.offset || "";
  } while (offset);

  return records.map(mapRecordToProduct);
}

function mapRecordToProduct(record) {
  const fields = record.fields || {};
  const photoList = Array.isArray(fields[FIELDS.photo]) ? fields[FIELDS.photo] : [];
  const firstPhoto = photoList[0] || {};
  const thumbnailLarge =
    firstPhoto &&
    firstPhoto.thumbnails &&
    firstPhoto.thumbnails.large &&
    firstPhoto.thumbnails.large.url
      ? firstPhoto.thumbnails.large.url
      : "";

  return {
    id: record.id || "",
    name: pickText(fields[FIELDS.name], "Untitled product"),
    price: pickText(fields[FIELDS.price], "Price unavailable"),
    imageUrl: pickText(thumbnailLarge, "") || pickText(firstPhoto.url, ""),
    readyToOrder: toBoolean(fields[FIELDS.readyToOrder]),
    telegramTarget: pickTelegramTarget(fields),
  };
}

function pickText(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function pickTelegramTarget(fields) {
  const candidates = [
    FIELDS.telegramTarget,
    "Telegram Channel",
    "Telegram Link",
    "Telegram Username",
  ];

  for (const fieldName of candidates) {
    const value = pickText(fields[fieldName], "");
    if (value) {
      return value;
    }
  }

  return "";
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "y"].includes(normalized);
  }

  return false;
}

async function readErrorBody(response) {
  try {
    const json = await response.json();

    if (json && typeof json.error === "string") {
      return json.error;
    }

    return JSON.stringify(json);
  } catch (_error) {
    return response.statusText || "Unknown error";
  }
}

function readLocalEnvFallback() {
  const envCandidates = [".env.local", ".env"];
  const mergedEnv = {};

  envCandidates.forEach((filename) => {
    const filepath = path.join(process.cwd(), filename);

    if (!fs.existsSync(filepath)) {
      return;
    }

    const content = fs.readFileSync(filepath, "utf8");
    Object.assign(mergedEnv, parseEnvText(content));
  });

  return mergedEnv;
}

function parseEnvText(content) {
  const parsed = {};

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const delimiterIndex = trimmed.indexOf("=");
    if (delimiterIndex < 0) {
      return;
    }

    const key = trimmed.slice(0, delimiterIndex).trim();
    let value = trimmed.slice(delimiterIndex + 1).trim();

    if (!key) {
      return;
    }

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  });

  return parsed;
}

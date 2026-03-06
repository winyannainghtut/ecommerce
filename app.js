/*
  FRONTEND CONFIG
  ------------------------------------------------------------------
  Update only your Telegram username here.

  Airtable credentials are now server-side only in Vercel Environment
  Variables. Do NOT put Airtable token/Base ID in this file.
*/

// Paste Telegram username only (without "@"), e.g. "your_store_username".
const TELEGRAM_USERNAME = "your_store_username";
const PRODUCTS_API_ENDPOINT = "/api/products";

const statusEl = document.getElementById("status");
const productGridEl = document.getElementById("product-grid");
const productCardTemplate = document.getElementById("product-card-template");
const searchInputEl = document.getElementById("search-input");
const sortSelectEl = document.getElementById("sort-select");
const clearFiltersEl = document.getElementById("clear-filters");
const resultCountEl = document.getElementById("result-count");
const totalMetricEl = document.getElementById("metric-total-products");
const visibleMetricEl = document.getElementById("metric-visible-products");

const state = {
  products: [],
};

init();

async function init() {
  attachUiEvents();

  if (!hasValidFrontendConfig()) {
    showError("Update TELEGRAM_USERNAME in app.js before publishing.");
    return;
  }

  applyTelegramLinks();

  try {
    setLoadingState(true);
    state.products = await fetchAllProducts();
    applyFiltersAndRender();
    setLoadingState(false);
  } catch (error) {
    console.error("Failed to load products:", error);
    showError(
      error && error.message
        ? `Could not load products: ${error.message}`
        : "Could not load products right now. Check Vercel env vars and your Airtable settings."
    );
  }
}

function hasValidFrontendConfig() {
  const placeholder = "YOUR_TELEGRAM_USERNAME";
  return TELEGRAM_USERNAME && TELEGRAM_USERNAME !== placeholder;
}

function applyTelegramLinks() {
  const cleanUsername = TELEGRAM_USERNAME.replace(/^@/, "").trim();
  const telegramProfileUrl = `https://t.me/${cleanUsername}`;

  document.querySelectorAll("[data-telegram-link]").forEach((linkEl) => {
    linkEl.href = telegramProfileUrl;
  });
}

function buildTelegramOrderUrl(product, message) {
  const target = product.telegramTarget || TELEGRAM_USERNAME;
  const baseUrl = normalizeTelegramTarget(target);
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}text=${encodeURIComponent(message)}`;
}

function normalizeTelegramTarget(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return `https://t.me/${TELEGRAM_USERNAME.replace(/^@/, "").trim()}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const username = trimmed.replace(/^@/, "");
  return `https://t.me/${username}`;
}

function attachUiEvents() {
  searchInputEl.addEventListener("input", applyFiltersAndRender);
  sortSelectEl.addEventListener("change", applyFiltersAndRender);

  clearFiltersEl.addEventListener("click", () => {
    searchInputEl.value = "";
    sortSelectEl.value = "featured";
    applyFiltersAndRender();
  });
}

async function fetchAllProducts() {
  const response = await fetch(PRODUCTS_API_ENDPOINT, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("API endpoint not found. Start with `npx vercel dev`, not a static server.");
    }

    let details = "";

    try {
      const errorData = await response.json();
      details = errorData.error ? `: ${errorData.error}` : "";
    } catch (_error) {
      details = "";
    }

    throw new Error(`API request failed with status ${response.status}${details}`);
  }

  const payload = await response.json();
  const products = Array.isArray(payload.products) ? payload.products : [];
  return products.map(normalizeProduct);
}

function normalizeProduct(product) {
  const name = safeText(product.name, "Untitled product");
  const price = safeText(product.price, "Price unavailable");
  const imageUrl = safeText(product.imageUrl, "");
  const readyToOrder = toBoolean(product.readyToOrder);
  const telegramTarget = safeText(product.telegramTarget, "");

  return {
    id: safeText(product.id, `${name}-${price}`),
    name,
    price,
    imageUrl: imageUrl || createFallbackImage(name),
    readyToOrder,
    telegramTarget,
  };
}

function safeText(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
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

function applyFiltersAndRender() {
  const searchValue = searchInputEl.value.trim().toLowerCase();
  const sortValue = sortSelectEl.value;

  let visibleProducts = state.products.filter((product) => {
    return product.name.toLowerCase().includes(searchValue);
  });

  visibleProducts = sortProducts(visibleProducts, sortValue);

  renderProducts(visibleProducts, searchValue.length > 0);
  updateCounters(visibleProducts.length, state.products.length);
}

function sortProducts(products, mode) {
  const clone = [...products];

  if (mode === "name-asc") {
    return clone.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (mode === "name-desc") {
    return clone.sort((a, b) => b.name.localeCompare(a.name));
  }

  if (mode === "price-asc") {
    return clone.sort((a, b) => compareByPrice(a.price, b.price, "asc"));
  }

  if (mode === "price-desc") {
    return clone.sort((a, b) => compareByPrice(a.price, b.price, "desc"));
  }

  return clone;
}

function compareByPrice(firstPrice, secondPrice, direction) {
  const firstValue = parsePriceNumber(firstPrice);
  const secondValue = parsePriceNumber(secondPrice);

  if (firstValue === null && secondValue === null) {
    return 0;
  }

  if (firstValue === null) {
    return 1;
  }

  if (secondValue === null) {
    return -1;
  }

  return direction === "asc" ? firstValue - secondValue : secondValue - firstValue;
}

function parsePriceNumber(priceText) {
  const numeric = String(priceText).replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const value = Number.parseFloat(numeric);
  return Number.isFinite(value) ? value : null;
}

function updateCounters(visibleCount, totalCount) {
  resultCountEl.textContent = `Showing ${visibleCount} of ${totalCount} products`;
  totalMetricEl.textContent = String(totalCount);
  visibleMetricEl.textContent = String(visibleCount);
}

function renderProducts(products, isFiltered) {
  productGridEl.innerHTML = "";

  if (!products.length) {
    productGridEl.innerHTML = `
      <div class="empty-state">
        ${
          isFiltered
            ? "No products match your current search. Try a different keyword or reset filters."
            : "No products were found in Airtable yet."
        }
      </div>
    `;
    return;
  }

  products.forEach((product, index) => {
    const card = productCardTemplate.content.firstElementChild.cloneNode(true);
    const imageEl = card.querySelector(".product-image");
    const badgeEl = card.querySelector(".product-badge");
    const nameEl = card.querySelector(".product-name");
    const priceEl = card.querySelector(".product-price");
    const orderButtonEl = card.querySelector(".order-button");

    imageEl.src = product.imageUrl;
    imageEl.alt = product.name;
    imageEl.loading = "lazy";

    nameEl.textContent = product.name;
    priceEl.textContent = product.price;
    badgeEl.textContent = product.readyToOrder ? "Ready to Order" : "Not Ready";
    badgeEl.classList.toggle("is-unavailable", !product.readyToOrder);

    card.style.animationDelay = `${Math.min(index * 40, 320)}ms`;
    orderButtonEl.disabled = !product.readyToOrder;
    orderButtonEl.classList.toggle("is-disabled", !product.readyToOrder);
    orderButtonEl.textContent = product.readyToOrder ? "Order via Telegram" : "Not Available";

    if (product.readyToOrder) {
      orderButtonEl.addEventListener("click", () => {
        const message = `Hello, I would like to order the ${product.name} for ${product.price}.`;
        const telegramUrl = buildTelegramOrderUrl(product, message);
        window.open(telegramUrl, "_blank", "noopener,noreferrer");
      });
    }

    productGridEl.appendChild(card);
  });
}

function setLoadingState(isLoading) {
  searchInputEl.disabled = isLoading;
  sortSelectEl.disabled = isLoading;
  clearFiltersEl.disabled = isLoading;

  statusEl.classList.toggle("is-hidden", !isLoading);
  statusEl.classList.remove("is-error");

  if (isLoading) {
    statusEl.innerHTML = `
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading products...</span>
    `;
  }
}

function showError(message) {
  statusEl.classList.remove("is-hidden");
  statusEl.classList.add("is-error");
  statusEl.innerHTML = `<span>${message}</span>`;
}

function createFallbackImage(label) {
  const safeLabel = escapeHtml(label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d7e3ff" />
          <stop offset="100%" stop-color="#f4f7ff" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg)" />
      <circle cx="660" cy="120" r="110" fill="rgba(15,74,217,0.1)" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Alegreya, Georgia, serif"
        font-size="42"
        font-weight="700"
        fill="#1f3f8b"
      >${safeLabel}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] || character;
  });
}

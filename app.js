/*
  FRONTEND CONFIG
  ------------------------------------------------------------------
  Telegram username and Airtable credentials are now server-side
  only in Vercel Environment Variables / .env.local.
  Do NOT put secrets in this file.
*/

const CONFIG_API_ENDPOINT = "/api/config";
const PRODUCTS_API_ENDPOINT = "/api/products";

const statusEl = document.getElementById("status");
const productGridEl = document.getElementById("product-grid");
const productCardTemplate = document.getElementById("product-card-template");
const skeletonCardTemplate = document.getElementById("skeleton-card-template");
const searchInputEl = document.getElementById("search-input");
const sortSelectEl = document.getElementById("sort-select");
const clearFiltersEl = document.getElementById("clear-filters");
const resultCountEl = document.getElementById("result-count");
const totalMetricEl = document.getElementById("metric-total-products");
const visibleMetricEl = document.getElementById("metric-visible-products");

// Modal elements
const modalOverlayEl = document.getElementById("product-modal");
const modalCloseEl = document.getElementById("modal-close");
const modalImageEl = document.getElementById("modal-image");
const modalNameEl = document.getElementById("modal-name");
const modalPriceEl = document.getElementById("modal-price");
const modalBadgeEl = document.getElementById("modal-badge");
const modalOrderEl = document.getElementById("modal-order");

// Theme toggle
const themeToggleEl = document.getElementById("theme-toggle");

// Scroll to top
const scrollTopEl = document.getElementById("scroll-top");

const state = {
  products: [],
  telegramUsername: "",
  currentModalProduct: null,
  currentCategory: "All",
};

init();

/* ================================================================
   INITIALIZATION
   ================================================================ */

async function init() {
  attachUiEvents();
  initTheme();
  initScrollToTop();

  try {
    setLoadingState(true);

    // Fetch config (Telegram username) from server
    const config = await fetchConfig();
    state.telegramUsername = config.telegramUsername || "";

    if (!hasValidConfig()) {
      showError("Set TELEGRAM_USERNAME in your Vercel environment variables or .env.local.");
      return;
    }

    state.products = await fetchAllProducts();
    renderCategoryMenu();
    applyFiltersAndRender();
    setLoadingState(false);
  } catch (error) {
    console.error("Failed to load:", error);
    showError(
      error && error.message
        ? `Could not load products: ${error.message}`
        : "Could not load products right now. Check Vercel env vars and your Airtable settings."
    );
  }
}

function hasValidConfig() {
  const placeholders = ["YOUR_TELEGRAM_USERNAME", "your_store_username", ""];
  return !placeholders.includes(state.telegramUsername);
}

/* ================================================================
   CONFIG FETCH
   ================================================================ */

async function fetchConfig() {
  const response = await fetch(CONFIG_API_ENDPOINT, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Config API failed with status ${response.status}`);
  }

  return response.json();
}

/* ================================================================
   TELEGRAM LINKS
   ================================================================ */

function applyTelegramLinks() {
  const cleanUsername = state.telegramUsername.replace(/^@/, "").trim();
  const telegramProfileUrl = `https://t.me/${cleanUsername}`;

  document.querySelectorAll("[data-telegram-link]").forEach((linkEl) => {
    linkEl.href = telegramProfileUrl;
  });
}

function buildTelegramOrderUrl(product, message) {
  const target = product.telegramTarget || state.telegramUsername;
  const baseUrl = normalizeTelegramTarget(target);
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}text=${encodeURIComponent(message)}`;
}

function normalizeTelegramTarget(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return `https://t.me/${state.telegramUsername.replace(/^@/, "").trim()}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const username = trimmed.replace(/^@/, "");
  return `https://t.me/${username}`;
}

/* ================================================================
   UI EVENTS
   ================================================================ */

function attachUiEvents() {
  searchInputEl.addEventListener("input", applyFiltersAndRender);
  sortSelectEl.addEventListener("change", applyFiltersAndRender);

  clearFiltersEl.addEventListener("click", () => {
    searchInputEl.value = "";
    sortSelectEl.value = "featured";
    state.currentCategory = "All";

    const categoryMenuEl = document.getElementById("category-menu");
    if (categoryMenuEl) {
      Array.from(categoryMenuEl.children).forEach(b => {
        b.classList.toggle("active", b.textContent === "All");
      });
    }

    applyFiltersAndRender();
  });

  // Modal events
  modalCloseEl.addEventListener("click", closeModal);
  modalOverlayEl.addEventListener("click", (e) => {
    if (e.target === modalOverlayEl) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalOverlayEl.classList.contains("is-open")) {
      closeModal();
    }
  });
}

/* ================================================================
   DARK MODE
   ================================================================ */

function initTheme() {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  themeToggleEl.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    }
  });
}

/* ================================================================
   SCROLL TO TOP
   ================================================================ */

function initScrollToTop() {
  window.addEventListener("scroll", () => {
    scrollTopEl.classList.toggle("is-visible", window.scrollY > 400);
  }, { passive: true });

  scrollTopEl.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ================================================================
   DATA FETCHING
   ================================================================ */

async function fetchAllProducts() {
  const response = await fetch(PRODUCTS_API_ENDPOINT, {
    cache: "no-store",
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
  const rawDescription = safeText(product.description, "");
  const description = cleanDescription(rawDescription);
  const imageUrl = safeText(product.imageUrl, "");
  const readyToOrder = toBoolean(product.readyToOrder);
  const telegramTarget = safeText(product.telegramTarget, "");

  return {
    id: safeText(product.id, `${name}-${price}`),
    name,
    price,
    description,
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

function cleanDescription(text) {
  if (!text) return "";

  // Convert Markdown links [Text](URL) into just "Text" to keep UI clean
  const strippedLinks = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove multiple consecutive empty lines
  return strippedLinks.replace(/\n\s*\n/g, "\n\n").trim();
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

/* ================================================================
   FILTERS & SORTING
   ================================================================ */

function applyFiltersAndRender() {
  const searchValue = searchInputEl.value.trim().toLowerCase();
  const sortValue = sortSelectEl.value;

  let visibleProducts = state.products.filter((product) => {
    const matchesCategory = state.currentCategory === "All" || product.category === state.currentCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchValue);
    return matchesCategory && matchesSearch;
  });

  visibleProducts = sortProducts(visibleProducts, sortValue);

  renderProducts(visibleProducts, searchValue);
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

/* ================================================================
   COUNTERS
   ================================================================ */

function updateCounters(visibleCount, totalCount) {
  resultCountEl.textContent = `Showing ${visibleCount} of ${totalCount} products`;

  animateCounter(totalMetricEl, totalCount);
  animateCounter(visibleMetricEl, visibleCount);
}

function animateCounter(element, target) {
  const current = parseInt(element.textContent, 10) || 0;

  if (current === target) {
    return;
  }

  const duration = 400;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(current + (target - current) * eased);

    element.textContent = String(value);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

/* ================================================================
   RENDERING
   ================================================================ */

function renderCategoryMenu() {
  const categoryMenuEl = document.getElementById("category-menu");
  if (!categoryMenuEl) return;

  categoryMenuEl.innerHTML = "";

  // Extract unique categories
  const categories = ["All"];
  state.products.forEach((product) => {
    if (product.category && product.category !== "Uncategorized" && !categories.includes(product.category)) {
      categories.push(product.category);
    }
  });

  // Render buttons
  categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-btn";
    btn.textContent = category;
    if (category === state.currentCategory) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      // Update state and UI
      state.currentCategory = category;
      Array.from(categoryMenuEl.children).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      applyFiltersAndRender();
    });

    categoryMenuEl.appendChild(btn);
  });
}

function renderProducts(products, searchQuery) {
  productGridEl.innerHTML = "";

  if (!products.length) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-state";
    emptyDiv.textContent = searchQuery.length > 0
      ? "No products match your current search. Try a different keyword or reset filters."
      : "No products were found in Airtable yet.";
    productGridEl.appendChild(emptyDiv);
    return;
  }

  products.forEach((product, index) => {
    const card = productCardTemplate.content.firstElementChild.cloneNode(true);
    const imageEl = card.querySelector(".product-image");
    const badgeEl = card.querySelector(".product-badge");
    const nameEl = card.querySelector(".product-name");
    const priceEl = card.querySelector(".product-price");
    const orderButtonEl = card.querySelector(".order-button");
    const detailsButtonEl = card.querySelector(".details-button");
    const mediaEl = card.querySelector(".card-media");

    imageEl.src = product.imageUrl;
    imageEl.alt = product.name;
    imageEl.loading = "lazy";

    // Search highlighting
    if (searchQuery.length > 0) {
      nameEl.innerHTML = highlightText(product.name, searchQuery);
    } else {
      nameEl.textContent = product.name;
    }

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

    // Click image or Details button to open modal
    mediaEl.addEventListener("click", () => {
      openModal(product);
    });
    detailsButtonEl.addEventListener("click", () => {
      openModal(product);
    });

    productGridEl.appendChild(card);
  });
}

/* ================================================================
   SEARCH HIGHLIGHTING
   ================================================================ */

function highlightText(text, query) {
  if (!query) {
    return escapeHtml(text);
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);

  return parts
    .map((part) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return `<mark>${escapeHtml(part)}</mark>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

/* ================================================================
   PRODUCT MODAL
   ================================================================ */

function openModal(product) {
  state.currentModalProduct = product;

  modalImageEl.src = product.imageUrl;
  modalImageEl.alt = product.name;
  modalNameEl.textContent = product.name;
  modalPriceEl.textContent = product.price;
  modalBadgeEl.textContent = product.readyToOrder ? "Ready to Order" : "Not Ready";
  modalBadgeEl.classList.toggle("is-unavailable", !product.readyToOrder);

  // Show description
  const modalDescEl = document.getElementById("modal-description");
  modalDescEl.textContent = product.description || "";

  // Always get the current button from the DOM (it may have been replaced)
  const currentOrderBtn = document.getElementById("modal-order");
  const newOrderBtn = currentOrderBtn.cloneNode(true);
  newOrderBtn.disabled = !product.readyToOrder;
  newOrderBtn.classList.toggle("is-disabled", !product.readyToOrder);
  newOrderBtn.textContent = product.readyToOrder ? "Order via Telegram" : "Not Available";

  if (product.readyToOrder) {
    newOrderBtn.addEventListener("click", () => {
      const message = `Hello, I would like to order the ${product.name} for ${product.price}.`;
      const telegramUrl = buildTelegramOrderUrl(product, message);
      window.open(telegramUrl, "_blank", "noopener,noreferrer");
    });
  }

  currentOrderBtn.parentNode.replaceChild(newOrderBtn, currentOrderBtn);

  modalOverlayEl.classList.add("is-open");
  modalOverlayEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalOverlayEl.classList.remove("is-open");
  modalOverlayEl.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  state.currentModalProduct = null;
}

/* ================================================================
   LOADING & ERROR STATES
   ================================================================ */

function setLoadingState(isLoading) {
  searchInputEl.disabled = isLoading;
  sortSelectEl.disabled = isLoading;
  clearFiltersEl.disabled = isLoading;

  statusEl.classList.toggle("is-hidden", !isLoading);
  statusEl.classList.remove("is-error");

  if (isLoading) {
    statusEl.textContent = "";
    const spinnerSpan = document.createElement("span");
    spinnerSpan.className = "spinner";
    spinnerSpan.setAttribute("aria-hidden", "true");
    const textSpan = document.createElement("span");
    textSpan.textContent = "Loading products...";
    statusEl.appendChild(spinnerSpan);
    statusEl.appendChild(textSpan);

    showSkeletonCards();
  }
}

function showSkeletonCards() {
  productGridEl.innerHTML = "";

  for (let i = 0; i < 6; i++) {
    const skeleton = skeletonCardTemplate.content.firstElementChild.cloneNode(true);
    productGridEl.appendChild(skeleton);
  }
}

function showError(message) {
  statusEl.classList.remove("is-hidden");
  statusEl.classList.add("is-error");
  statusEl.textContent = "";

  const span = document.createElement("span");
  span.textContent = message;
  statusEl.appendChild(span);

  const retryBtn = document.createElement("button");
  retryBtn.className = "retry-button";
  retryBtn.type = "button";
  retryBtn.textContent = "Try Again";
  retryBtn.addEventListener("click", () => {
    statusEl.classList.remove("is-error");
    init();
  });
  statusEl.appendChild(retryBtn);
}

/* ================================================================
   UTILITIES
   ================================================================ */

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
        font-family="Ubuntu, sans-serif"
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

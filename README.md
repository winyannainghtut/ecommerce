# The Little Things — Catalog (Vercel + Airtable + Telegram)

A serverless shopping catalog that pulls products from Airtable and lets customers order via Telegram.

## Features

- **Dynamic Categories** — auto-generated category menu from the Airtable `Category` column; filter products instantly
- **Product Detail Modal** — click any product image or "Details" button for an enlarged view with description
- **Dark Mode** — toggle in topbar, persists in `localStorage`, auto-detects system preference
- **Skeleton Loading** — shimmer placeholders while products load
- **Scroll to Top** — fixed button appears after scrolling down
- **Search & Sort** — real-time search with highlighted matches; sort by name or price
- **Retry on Error** — "Try Again" button on error states
- **Responsive Design** — adapts to desktop, tablet, and mobile
- **Glassmorphism UI** — frosted glass panels with animated background gradients

## Project Structure

| File | Role |
|---|---|
| `index.html` | Page markup with product card & skeleton templates |
| `style.css` | Styling with CSS variables, dark mode, glassmorphism, responsive breakpoints |
| `app.js` | Frontend logic — fetch, filter, sort, render, modal, theme, categories |
| `api/products.js` | Serverless Airtable proxy (returns product JSON) |
| `api/config.js` | Serverless config endpoint (returns Telegram username) |
| `.env.local` | Local environment variables (git-ignored) |

## Airtable Setup

**Table name:** `Products` (or set custom via `AIRTABLE_TABLE_NAME`)

**Required fields:**

| Field | Type | Description |
|---|---|---|
| `Name` | Text | Product name |
| `Price` | Text | Display price (e.g. `100MMK`) |
| `Photo` | Attachment | Multiple images are supported (shown in modal gallery) |
| `Category` | Single select / Text | Category label (e.g. `Character keychains`, `Stationery`) |
| `Description` | Long text | Shown in product detail modal |
| `Ready to Order` | Checkbox | Enables the order button |
| `Telegram Target` | Text (optional) | Per-product Telegram destination |

`Telegram Target` accepts:
- Username: `your_store_username` or `@your_store_username`
- Full URL: `https://t.me/your_store_username`

## Configuration

### Environment Variables

Set these in **Vercel Project Settings → Environment Variables** and in `.env.local` for local dev:

```env
AIRTABLE_TOKEN=your_read_only_airtable_token
AIRTABLE_BASE_ID=your_airtable_base_id
AIRTABLE_TABLE_NAME=Products
TELEGRAM_USERNAME=your_telegram_username
```

| Variable | Required | Description |
|---|---|---|
| `AIRTABLE_TOKEN` | ✅ | Airtable read-only Personal Access Token |
| `AIRTABLE_BASE_ID` | ✅ | Airtable base ID (e.g. `appXXXXXX`) |
| `AIRTABLE_TABLE_NAME` | ❌ | Defaults to `Products` |
| `TELEGRAM_USERNAME` | ✅ | Default Telegram username for ordering |

> **Note:** No secrets are exposed in frontend code. The Airtable token stays server-side, and the Telegram username is served via `/api/config`.

## Local Development

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Create `.env.local`

```env
AIRTABLE_TOKEN=your_read_only_airtable_token
AIRTABLE_BASE_ID=your_airtable_base_id
AIRTABLE_TABLE_NAME=Products
TELEGRAM_USERNAME=your_telegram_username
```

### 3. Run dev server

```bash
npx vercel dev
```

Open: `http://localhost:3000`

> **Important:** Do not use a static file server. This app requires `/api/products` and `/api/config`, which only work via `npx vercel dev` or Vercel deployment.

### 4. Verify

1. Products load in the grid with skeleton placeholders during fetch
2. Category pills appear in the left sidebar matching your Airtable `Category` values
3. Search filters products and highlights matching text
4. Sort by name/price works
5. Dark mode toggle persists across page reloads
6. Clicking a product image opens the detail modal with description
7. "Ready to Order" products open Telegram on order button click
8. Products with `Telegram Target` use that destination; otherwise fallback to `TELEGRAM_USERNAME`

## Deploy to Vercel

1. Push project to GitHub
2. Import project in Vercel
3. Add environment variables: `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `TELEGRAM_USERNAME` (and optionally `AIRTABLE_TABLE_NAME`)
4. Deploy

## Security

- Airtable token is server-side only — never exposed to the browser
- Telegram username is served via a server endpoint, not hardcoded in JS
- If a token was ever committed to Git history, rotate it immediately

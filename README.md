# Khaw Gyi Catalog (Vercel + Airtable + Telegram)

Serverless catalog website built with:
- `index.html`
- `style.css`
- `app.js`
- Vercel serverless function at `api/products.js`

## Why this setup

Airtable API credentials are kept server-side in Vercel Environment Variables.
The browser only calls `/api/products`, so your Airtable token is not exposed publicly.

## Project Structure

- `index.html` - page markup
- `style.css` - UI styling
- `app.js` - frontend logic (fetch products, render cards, Telegram order action)
- `api/products.js` - serverless proxy to Airtable API

## Airtable Requirements

Table name:
- `Products` (or set custom via env var)

Expected field names in that table:
- `Name`
- `Price`
- `Photo` (Attachment field; first image is used)
- `Ready to Order` (Checkbox/Boolean)
- `Telegram Target` (optional text; per-product Telegram destination)

`Telegram Target` supports:
- Telegram username (example: `your_store_username` or `@your_store_username`)
- Full Telegram URL (example: `https://t.me/your_store_username`)

## Configuration

### 1) Frontend config (`app.js`)

Set only this:
- `TELEGRAM_USERNAME` (without `@`)

Example:
```js
const TELEGRAM_USERNAME = "your_store_username";
```

### 2) Serverless env vars (Vercel)

Set these in Vercel Project Settings -> Environment Variables:

- `AIRTABLE_TOKEN` = your Airtable read-only PAT
- `AIRTABLE_BASE_ID` = your base id (example: `app...`)
- `AIRTABLE_TABLE_NAME` = `Products` (optional, defaults to `Products`)

## Local Testing

Use Vercel local runtime so `/api/products` works locally.

### 1) Install Vercel CLI (if not installed)

```bash
npm i -g vercel
```

or use:

```bash
npx vercel --version
```

### 2) Create local env file

Create `.env.local` in project root:

```env
AIRTABLE_TOKEN=your_read_only_airtable_token
AIRTABLE_BASE_ID=your_airtable_base_id
AIRTABLE_TABLE_NAME=Products
```

### 3) Run local dev server

```bash
npx vercel dev
```

Open:
- `http://localhost:3000`

Important:
- Do not use `python -m http.server` for this project anymore.
- This app needs the Vercel function route `/api/products`, which only works via `npx vercel dev` (local) or Vercel deployment.

### 4) Functional checks

1. Products load in grid.
2. Search and sort work.
3. Products with `Ready to Order = false` show `Not Ready` and have disabled order button.
4. Products with `Ready to Order = true` open product-specific Telegram from `Telegram Target` if provided.
5. If `Telegram Target` is empty, it falls back to `TELEGRAM_USERNAME` in `app.js`.
6. `api/products` returns JSON in browser/network tab.

## Deploy to Vercel

1. Push project to GitHub (or use Vercel import).
2. Import project in Vercel.
3. Add environment variables:
   - `AIRTABLE_TOKEN`
   - `AIRTABLE_BASE_ID`
   - `AIRTABLE_TABLE_NAME` (optional)
4. Deploy.

After deploy, your frontend calls `/api/products` on the same domain.

## Security Note

If an Airtable token was ever committed/shared in frontend code, rotate it and create a new read-only token with minimal scopes.

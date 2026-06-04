# MM Engineering — Supplier Portal

Internal web application for MM Engineering Services to manage supplier relationships, brand data, and procurement comparisons.

---

## What this app does

- Search and browse 1,000+ brands and their suppliers
- Traffic light status per supplier (green / amber / red)
- AI approval flags per supplier
- Price comparison tracking per part number
- Live activity feed and leaderboard
- Role-based access (admin / member)
- Priority task management

---

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (database, auth, realtime) |
| Drag and drop | dnd-kit |
| Hosting | Vercel |

---

## Project structure

```
app/
  (auth)/login/          — Login page
  (app)/
    page.tsx             — Home (search, activity, leaderboard, tasks)
    brands/              — Brand list + brand detail + add/edit
    suppliers/           — Add/edit supplier
    price-comparisons/   — Price comparison tool
    admin/               — Admin dashboard (admin only)
    admin/users/         — User management (admin only)
  api/
    auth/callback/       — Auth callback
    admin/create-user/   — Server-side user creation

components/
  auth/                  — Login form
  brand/                 — Brand header, brand list, brand form
  supplier/              — Supplier card, form, notes, toggles
  home/                  — Search bar, activity panel, leaderboard, priority tasks
  layout/                — Sidebar, top bar
  pricing/               — Price comparison form
  ui/                    — Button, Input, Modal, Toast

lib/
  supabase/              — Browser client, server client
  hooks/                 — useUser (role-aware), useRealtimeChannel
  types/                 — Database types, app types
  utils/                 — Tailwind merge helper, date formatters
```

---

## User roles

| Role | Permissions |
|---|---|
| **Member** | View all data, add/edit/delete brands and suppliers, add notes, price comparisons |
| **Admin** | Everything a member can do, plus traffic light, AI toggles, priority tasks, user management, admin dashboard |

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# 3. Run
npm run dev
```

---

## Deployment

Hosted on Vercel. Add the three environment variables above in Vercel project settings. Every push to `main` redeploys automatically.

---

## Team accounts

Managed by admins via the portal at `/admin/users`.

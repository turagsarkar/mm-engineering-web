# MM Engineering — Supplier Portal

Internal web application for MM Engineering Services to manage supplier relationships, brand data, and procurement comparisons.

---

## What this app does

The MM Engineering team sources industrial parts from hundreds of suppliers across many brands. Before this portal existed, all supplier data lived in spreadsheets with no access control, no history, and no way for the team to collaborate in real time.

This portal gives the team:

- A single searchable database of 1,000+ brands and their suppliers
- Traffic light status per supplier (green = use, amber = caution, red = avoid)
- AI approval flags that control which suppliers the automated n8n email workflow contacts
- Price comparison tracking per part number
- A live activity feed and leaderboard
- Role-based access so only admins can change sensitive flags

---

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Realtime | Supabase Realtime |
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
    auth/callback/       — Supabase auth callback
    admin/create-user/   — Server-side user creation

components/
  auth/                  — Login form
  brand/                 — Brand header, brand list, brand form
  supplier/              — Supplier card, form, notes, traffic light, AI toggle
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

| Role | What they can do |
|---|---|
| **Member** | View all brands and suppliers, add/edit/delete brands and suppliers, add notes, price comparisons, drag-drop reorder |
| **Admin** | Everything a member can do, plus: change traffic light, toggle AI approval, toggle confirmed suppliers, toggle AI do-not-quote, add/complete priority tasks, manage team members, view admin dashboard |

Roles are enforced at the database level via Supabase Row Level Security — hiding a button in the UI is not the only protection.

---

## Database

The database lives in Supabase (Project: **S.T.E.V.E**). Key tables:

| Table | Purpose |
|---|---|
| `profiles` | Team members and their roles |
| `brands` | 1,000+ brands with AI flags and review schedule |
| `suppliers` | Suppliers linked to brands, with traffic light and AI approval |
| `supplier_notes` | Structured notes per supplier |
| `activity_log` | Every add/edit/delete action with user and timestamp |
| `priority_tasks` | Tasks set by admins, visible to whole team |
| `price_comparisons` | Price comparison headers per part number |
| `price_comparison_lines` | Per-supplier price entries |
| `enquiry_log` | RFQ history written by the n8n workflow (read-only in this app) |
| `manual_review_queue` | Emails the n8n workflow flagged for human review (read-only) |

---

## Connection to n8n

This portal shares the same Supabase database as the **MM Engineering n8n automation workflow**. The workflow:

- Reads `brands` and `suppliers` to decide who to email
- Writes to `enquiry_log` when RFQs are sent
- Writes to `manual_review_queue` when emails need human review

**The web app never modifies `enquiry_log`, `processed_emails`, or `manual_review_queue` — those are read-only from the web side.** The n8n workflow uses the service role key and bypasses Row Level Security. The web app uses the anon key and respects it.

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local
NEXT_PUBLIC_SUPABASE_URL=https://mwlpgnwqeibkgzcvnhcd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service role key>

# 3. Run dev server
npm run dev
```

Open `http://localhost:3000` — redirects to login automatically.

---

## Deployment

Hosted on Vercel. Every push to `main` triggers an automatic redeploy.

Add the same three environment variables from `.env.local` in the Vercel project settings.

---

## Team accounts

Accounts are managed by admins via the portal at `/admin/users`. No Supabase dashboard access is required to add or remove team members.

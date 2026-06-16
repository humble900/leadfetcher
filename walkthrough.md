# 🚶‍♂️ Walkthrough — Verification & Production Hardening

We have successfully audited the entire LeadFetcher monorepo, resolved critical environment and database infrastructure blockers, implemented all required Next.js Dashboard frontend pages using pure CSS Modules, added a premium landing page, and successfully compiled all workspaces.

---

## 1. Resolved Blockers & Production Hardening

### 1.1 Docker Database & Queue Setup
- Configured and launched PostgreSQL and Redis inside Docker containers using a revised `docker-compose.yml` mapping ports to `54321` and `63791` respectively to avoid conflicts with other active host containers.
- Applied all schema migrations (`npm run db:migrate`) and seeded the database (`npm run db:seed`) to create default subscription plans and the Super Admin account (`admin@leadfetcher.com` / `changeme123!`).

### 1.2 ESM Environment Variables Hoisting
- Resolved a classic ES Modules hoisting issue where route modules executed `getEnv()` (validating the environment via Zod) before inline `dotenv.config()` was parsed.
- Created dedicated configuration files:
  - [dotenv.ts (API)](file:///c:/Users/USER/leadfetcher/apps/api/src/config/dotenv.ts)
  - [dotenv.ts (Worker)](file:///c:/Users/USER/leadfetcher/apps/worker/src/config/dotenv.ts)
- Imported these config modules as the first line in all server, worker, and seed entry points, ensuring `.env` is loaded before any dependency evaluation occurs.

---

## 2. Next.js Dashboard Frontend Implementation

We built out the entire dashboard frontend under `apps/dashboard` from scratch, utilizing HSL design tokens for high-fidelity dark themes:

1. **Session Client Wrapper (`src/lib/api.ts`)**:
   - Fetches from `http://localhost:4000/api` with `credentials: 'include'` to pass session tokens stored in HttpOnly cookies.
2. **Context Auth Provider & Guard (`src/components/layout/AuthContext.tsx` & `AuthGuard.tsx`)**:
   - Manages global state (user context and tenant ID workspace).
   - Automatically guards private pages and redirects guests.
3. **Responsive Layout Structure (`src/components/layout/DashboardLayout.tsx`)**:
   - A sidebar navigation with active path highlights.
   - An elegant header with stats overview and a workspace/tenant selector.
4. **Key Views**:
   - **Overview Dashboard (`src/app/page.tsx`)**: High-level telemetry stats (leads, active/total crawls, verification rates) and a recent crawls list.
   - **Leads Table (`src/app/leads/page.tsx`)**: Compact cell layouts, pagination, jump-to-page, details modal, and a column-level selection exporter.
   - **Crawl Configuration & Management (`src/app/jobs/page.tsx` & `jobs/new/page.tsx` & `jobs/[id]/page.tsx`)**: Form configuring target URL, extraction mode (regex, LLM, listing), and real-time execution console logs with socket integration.
   - **Workspace Limits & Admin Portal (`src/app/usage/page.tsx` & `admin/settings/page.tsx`)**: Tenant quota gauges and workspace config management.

---

## 3. Premium Landing Page Addition

To support guest navigation, we implemented a gorgeous marketing landing page at the root route `/`:

1. **Routing Changes (`AuthGuard.tsx` & `DashboardLayout.tsx`)**:
   - Added `/` to the public path list.
   - Restructured layout and auth guards so unauthenticated users see the landing page directly, while logged-in users see the full dashboard metrics overview.
   - Avoided redirect loops when logged-in users visit `/`.
2. **Landing Page View (`src/app/page.tsx` & `page.module.css`)**:
   - Designed a stunning glassmorphic dark theme using customized radial gradients and orange glow accent borders.
   - **Hero Section**: Features a floating badge, a bold gradient heading, and an interactive dashboard simulation showing live crawler logs, active status indicators, and success rates.
   - **Features Grid**: Outlines the platform's key features (Deep Crawling, Verified Contacts, Custom Exporter) using glowing modern icon cards.
   - **Technology Stack**: Displays the visual technology logos (Next.js, TypeScript, BullMQ, Prisma, Redis, Docker).
   - **Pricing Plans**: Beautiful columns representing Free, Pro, and Enterprise tiers with high-contrast active styling on the Pro card.

---

## 4. Verification

We successfully compiled the workspaces:
```bash
npm run build
```
Resulting in zero TypeScript compile errors or static generation warnings across the workspaces (`@leadfetcher/shared`, `@leadfetcher/api`, `@leadfetcher/worker`, and `dashboard`).

---

## 5. Git Repository Initialization

- Initialized Git in the workspace root: `git init`.
- Configured `.gitignore` files to properly exclude directories such as `node_modules`, `.next`, `dist`, `.turbo`, and environment config `.env`.
- Executed the initial commit: `git commit -m "feat: implement premium landing page and setup monorepo routing"`.

---

## 6. Railway Monorepo Deployment & Infrastructure as Code (IaC) Setup

We resolved the deployment blockers and successfully brought the entire monorepo stack online on Railway:

### 6.1 Unified Build Configuration
- Migrated services to compile and run from the repository root instead of subdirectories to resolve hoisted dependency and workspace symlink issues.
- Updated root `package.json` `build` script to build workspaces sequentially (`npm run build:shared && ...`) to prevent race conditions during type compilation.
- Removed all `tsconfig.tsbuildinfo` build-cache files from git tracking and added them to `.gitignore` to prevent TypeScript resolution errors on build servers.

### 6.2 Railway Infrastructure as Code Configuration
- Initialized and deployed using Railway IaC configuration file at [.railway/railway.ts](file:///c:/Users/USER/leadfetcher/.railway/railway.ts) with `NODE_OPTIONS="--import tsx"`.
- Defined all 5 project resources (`Postgres`, `Redis`, `@leadfetcher/api`, `@leadfetcher/worker`, and `dashboard`) with their exact GitHub source branches, root paths, build/start commands, and cross-referenced environment variables (`DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_API_URL`, and `CORS_ORIGIN`).
- Preserved existing production-critical variables (e.g. database secrets and verified public URLs) seamlessly using `preserve()`.

### 6.3 Automated Database Migration & Seeding
- Executed the production migrations and seeded the live Railway database using the public proxy URL:
  ```bash
  $env:DATABASE_URL="postgresql://postgres:oFmfXMosnAoTxGfUAWWHSupSGXfDXaSY@acela.proxy.rlwy.net:57782/railway"
  npm run db:migrate
  npm run db:seed
  ```
- **Deployment Status**: All 5 services (databases and applications) are currently fully verified, compiled, and `● Online` in production.

---

## 7. Manual Subscription Management System & Limits Overrides

We designed and built a premium, manual subscription upgrading and management system that lets regular users request upgrades via support, lets administrators toggle upgrade settings, and allows superadmins to customize tenant limits from a central dashboard:

### 7.1 Database Limits & Overrides Schema
- Added a `customLimits` column (`jsonb` format) to the `tenants` table schema in both [schema.ts (API)](file:///c:/Users/USER/leadfetcher/apps/api/src/db/schema.ts) and [db-schema.ts (Worker)](file:///c:/Users/USER/leadfetcher/apps/worker/src/processors/db-schema.ts).
- Generated a new Drizzle Kit SQL migration (`0003_aspiring_nomad.sql`) and successfully ran it (`npm run db:migrate`) to alter the database table in production.
- Refactored `limitMiddleware` in `apps/api/src/middleware/limit.middleware.ts` to inspect the tenant's `customLimits` and apply field-specific limits (e.g. `maxLeadsMonthly`, `maxJobsMonthly`) if they override the default plan limits.
- Updated [jobs.routes.ts](file:///c:/Users/USER/leadfetcher/apps/api/src/routes/jobs.routes.ts) and [usage.service.ts](file:///c:/Users/USER/leadfetcher/apps/api/src/services/usage.service.ts) to resolve limit indicators using the dynamic database overrides and pass correct values to worker execution threads through BullMQ.

### 7.2 Dynamic Subscription Info API & User Settings Page
- Created a new user-facing `/settings` page at [page.tsx](file:///c:/Users/USER/leadfetcher/apps/dashboard/src/app/settings/page.tsx) with glassmorphism layout and design cards for Free, Pro, and Enterprise plan comparison.
- Added a `GET /api/usage/subscription` API route to retrieve comparison details, current tenant plan, the active payment mode, and the dynamic WhatsApp support contact number.
- Linked user upgrade buttons to WhatsApp at `https://wa.me/<number>` using pre-filled request templates containing the tenant email and destination plan name.
- Integrated the User Avatar in the header and added a new footer link in the Sidebar right above Logout to navigate directly to the new Settings workspace.

### 7.3 Centralized Superadmin Controls & Payment Mode Toggle
- Added a central "Tenant Subscriptions" dashboard at [admin/subscriptions/page.tsx](file:///c:/Users/USER/leadfetcher/apps/dashboard/src/app/admin/subscriptions/page.tsx) with Search and Workspace management filters.
- Built a premium modal editor that allows superadmins to change any workspace's plan tier and assign custom numeric overrides for leads monthly, job monthly, max pages, concurrent crawls, and LLM token usage.
- Created a "Payment Mode Configuration" panel in Admin Settings to toggle between **Manual** and **Automatic** upgrade modes.
- Added a dynamic WhatsApp Support Number editor inside the Admin Settings page to easily manage the recipient number globally.
- Implemented compatibility handlers in the admin settings API routes to map legacy frontend parameters (`paidVersionActive` <-> `paidMode`) and accept both `POST` and `PUT` request types.

---

## 8. Verification Results

All workspaces built successfully on type-checks and Next.js static page generation:
- ✅ **Monorepo Build**: `npm run build` completed successfully.
- ✅ **API & Worker Compilation**: All backend services compiled with no type errors.
- ✅ **Dashboard Production Bundle**: Next.js turbopack built all 14 routes successfully.
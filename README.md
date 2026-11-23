# LicenseIQ — Software License & Subscription Intelligence Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-336791?logo=postgresql)](https://neon.tech/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://www.prisma.io/)
[![Python](https://img.shields.io/badge/FastAPI-Pandas_NumPy-009688?logo=fastapi)](https://fastapi.tiangolo.com/)

> **A centralized, full-stack enterprise SaaS license governance and subscription intelligence platform.** Built to eradicate spreadsheet sprawl, eliminate dormant/idle seat waste, detect duplicate tool subscriptions, streamline employee provisioning, and prevent unmonitored auto-renewals through deterministic mathematical intelligence and explainable rule-based recommendations.

---

## Academic & Institutional Context

This project was developed as a **Field Engineering Project (FEP)** under the curriculum of Savitribai Phule Pune University (SPPU):

- **Course Code:** `CE124FP309` (Field Engineering Project)
- **Academic Year:** 2026–2027
- **Department:** Department of Computer Engineering
- **Institution:** D. Y. Patil College of Engineering, Akurdi, Pune – 411044
- **Affiliation:** Savitribai Phule Pune University (SPPU)
- **Project Guide:** **Mrs. Prachi Hinge** (Assistant Professor, Department of Computer Engineering)
- **Project Team:**
  - **Alfiya Jahangir Shaikh**
  - **Shrawani Vijay Sonawane**
  - **Suraj Vittal Jadhav**
  - **Priti Narendra Udata**

---

## Core Features & Intelligence Modules

### 1. Role-Based Access Control (RBAC) & Secure Session Authentication
- **Multi-Role Privilege Matrix**: Strict access control across **`ADMIN`**, **`MANAGER`**, and **`EMPLOYEE`** roles implemented at both client UI (sidebar routing and page guards) and backend API layers (`requireAuth` utility with HTTP 401/403 responses).
- **Security Standards**: Password hashing via `bcryptjs` (10 salt rounds), digitally signed stateless `JWT` sessions, and HTTP-only cookie transport (`auth_token`).
- **Interactive Role Switcher**: Quick one-click preset role login buttons on `/login` to test and demonstrate role-specific privileges instantly.

### 2. Executive KPI Dashboard & Real-Time Financial Visibility
- **Primary Financial Metrics**: Displays real-time **Monthly Expenditure (₹)**, **Annualized Spend (₹)**, and **Potential Recoverable Savings (₹)** calculated deterministically from active seat pools and billing frequencies (`MONTHLY`, `ANNUAL`, `ONE_TIME`).
- **Overall License Utilization**: Aggregate seat efficiency metric ($\text{Active Assignments} / \text{Total Purchased Seats} \times 100$) with visual breakdown badges: *Optimal*, *Underutilized*, and *Critical*.
- **Composite Subscription Health Score (0–100%)**: An explainable 5-factor weighted scoring algorithm:
  $$\text{Score} = S_{\text{util}} (35) + S_{\text{cost}} (25) + S_{\text{renewal}} (20) + S_{\text{unused}} (10) + S_{\text{overlap}} (10)$$
- **Upcoming Renewals & Expiration Radar**: Dynamic alert counter highlighting contracts expiring in $\le 7$ days, $\le 30$ days, or already expired.

### 3. 4-Tier Seat Classification & Telemetry Activity Ledger
- **4-Tier Seat Classification**:
  - 🟢 **Optimal**: Active within $\le 30$ days with engagement $\ge 10$ hours or $\ge 5$ logins.
  - 🟡 **Underutilized**: Inactive for $31–60$ days or showing low usage engagement ($<10$ hours / $<5$ logins).
  - 🔴 **Idle (>60d)**: Dormant for $>60$ days with zero recent activity; prime candidate for immediate reclamation before buying new seats.
  - ⚪ **Unassigned**: Purchased seats remaining in the unallocated inventory pool.
- **Telemetry Ingestion Engine (`usage_records`)**: API endpoint (`POST /api/usage-logs`) tracking real-time client telemetry: `lastActiveDate`, `hoursUsed`, `loginCount`, and `tokensUsed`.
- **Live Telemetry Activity Ledger**: Interactive searchable data grid with quick filter pills, inactivity alerts, and a modal simulator to inject sample usage telemetry events live.

### 4. Rule-Based AI Optimization & Recommendation Engine
- **Deterministic Explainable Rules**:
  1. *Idle Seat Reduction*: Identifies applications with $<70\%$ seat utilization and unused inventory to recommend contract downscaling.
  2. *License Re-Use Pre-Check*: Cross-checks unallocated capacity against incoming software requests to prevent unnecessary procurement.
  3. *Contract Renewal Rightsizing*: Analyzes upcoming renewals ($\le 30$ days) with low utilization to renegotiate seat counts.
  4. *High-Spend Optimization*: Flags software with monthly spend $\ge ₹30,000$ and utilization $<60\%$ for executive priority audit.
  5. *Category Tool Redundancy*: Detects overlapping subscriptions within identical categories (e.g., Slack + Microsoft Teams, Jira + Asana).
- **Financial Projections**: Every recommendation calculates exact estimated monthly and annualized INR (`₹`) cost recovery.

### 5. Smart Software Request & Idle-Seat Pre-Check Pipeline
- **Employee Request Portal**: Employees can search the enterprise catalog and submit requests with justification and priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Automated Idle-Seat Pre-Check**:
  - Automatically verifies if **unassigned pool seats** already exist.
  - Identifies existing users with **dormant/idle seats (>60 days inactive)** for the requested software.
- **Atomic One-Click Reclaim & Approve**:
  - Managers can approve requests via a single atomic PostgreSQL transaction (`RECLAIM_AND_ASSIGN`).
  - Automatically revokes the idle seat from the dormant user, reassigns the seat to the requester, updates the request to `FULFILLED_EXISTING`, and writes three sequential, immutable audit log entries (`REVOKE_LICENSE`, `ASSIGN_LICENSE`, `APPROVE_REQUEST`).

### 6. Duplicate Subscription & Overlap Detection
- **Dedicated Screen (`/analytics/duplicates`)**: Groups applications by functional category (e.g., *Team Collaboration*, *Project Management*, *Design & Multimedia*) to identify redundant software sprawl.
- **Dual-Subscribed Department Matrix**: Side-by-side comparison tables highlighting which departments are paying for multiple competing tools.
- **Strategic Action**: One-click **"Flag for Consolidation"** button that persists a `DUPLICATE_CONSOLIDATION` recommendation with automatic audit trail recording.

### 7. Risk-Tiered Contract Renewal Governance
- **Expiration Categorization**: Chronological contract radar categorized into `Expired`, `Due in ≤7 Days`, `Due in ≤30 Days`, and `Future Renewals`.
- **Auto-Renewal Controls**: Toggle switch per contract to disable automated vendor billing, preventing surprise renewals for underutilized software.

### 8. Department Cost Centers & Budget Adherence
- **Department Financial Ledger**: Tracks monthly and annualized spend against allocated IT budgets across *Engineering*, *Product & Design*, *Marketing*, *Sales*, *Human Resources*, and *Operations*.
- **Over-Budget Warnings**: Progress bars visually highlighting departments nearing or exceeding their monthly budget ceiling.

### 9. Immutable Audit Trail & Universal Export Engine
- **PostgreSQL-Grounded Audit Log (`audit_logs`)**: Append-only log recording actor ID, IP address, timestamp, action type, entity, and JSON metadata for every lifecycle event.
- **Action Filter Pills**: Filter by *All Actions*, *Revoke License*, *Assign License*, *Approve Request*, *Reject Request*, *Recommendations*, and *Updates & Telemetry*.
- **Executive PDF Report Generator**: One-click professional PDF audit report generated via `jsPDF` + `jspdf-autotable`.
- **RFC 4180 Universal CSV Export**: Export buttons across all core pages with UTF-8 BOM encoding for correct INR (`₹`) symbol rendering in Microsoft Excel and Google Sheets.

### 10. Hybrid Python FastAPI + TypeScript Analytics Bridge
- **Vectorized Microservice (`/python_service`)**: High-performance Python FastAPI service leveraging `Pandas` and `NumPy` for vectorized matrix analytics and batch health scoring.
- **Live Health-Check Bridge**: Next.js proxy route (`/api/analytics/fastapi-proxy`) performing live probes to `http://localhost:8000/`.
- **Dynamic Diagnostics on `/settings`**:
  - *Online*: Displays roundtrip latency (e.g. `130ms`) with green status indicators.
  - *Offline / Graceful Fallback*: Automatically engages the native TypeScript analytics engine with 100% mathematical parity and displays a copyable startup command hint (`uvicorn main:app --reload --port 8000`).

---

## System Architecture & Tech Stack

```mermaid
graph TB
    subgraph Client ["Client Presentation Tier (Browser)"]
        UI["Next.js 14 Responsive UI (Tailwind CSS + Lucide Icons)"]
        Charts["Recharts Visualizations & jsPDF Engine"]
    end

    subgraph AppServer ["Application & API Tier (Next.js 14 App Router)"]
        Router["Next.js Route Handlers & Server Actions"]
        Auth["JWT Authentication & RBAC Guard"]
        TSEngine["Native TypeScript Vectorized Analytics Engine"]
        Proxy["FastAPI Microservice Proxy & Health Bridge"]
    end

    subgraph Microservice ["Python Analytics Tier (FastAPI :8000)"]
        FastAPI["FastAPI High-Performance API"]
        Pandas["Pandas & NumPy Vectorized Processing"]
    end

    subgraph DataTier ["Persistence Tier (Neon Cloud PostgreSQL)"]
        Prisma["Prisma ORM v5.22"]
        Postgres[("PostgreSQL 16 Normalized Database (14 Tables)")]
    end

    UI --> Router
    Router --> Auth
    Router --> Prisma
    Router --> Proxy
    Proxy -->|When Online| FastAPI
    Proxy -->|When Offline (Fallback)| TSEngine
    FastAPI --> Pandas
    Prisma --> Postgres
```

### Complete Technology Stack

| Layer | Technologies | Description |
|---|---|---|
| **Frontend Framework** | `Next.js 14.2` (App Router), `React 18.3` | Server & Client components with optimized streaming SSR |
| **Language** | `TypeScript 5.6` | 100% end-to-end type safety |
| **Styling & Icons** | `Tailwind CSS 3.4`, `Lucide React 0.441` | Modern pastel enterprise UI (`rounded-[28px]`, `#E3DCFD`, `#D7EFEA`, `#FEF1C9`, `#FDDCE5`) |
| **Visualizations** | `Recharts 2.12` | Responsive Area, Bar, Stacked, and Pie charts |
| **Reporting & Export** | `jsPDF 2.5`, `jspdf-autotable 3.8`, `lib/exportCsv.ts` | PDF executive audit reports and RFC 4180 CSV exports |
| **Database** | `PostgreSQL 16` (Neon Serverless Cloud) | Fully normalized persistent relational database |
| **ORM** | `Prisma ORM 5.22` | Declarative schema, migrations, type-safe query generation |
| **Authentication** | `jsonwebtoken 9.0`, `bcryptjs 2.4` | Stateless signed JWTs in HTTP-only cookies with salt rounds |
| **Analytics Microservice** | `Python 3.14`, `FastAPI 0.142`, `Pandas 2.3`, `NumPy 2.4` | High-throughput vectorized matrix computations |
| **Deployment Target** | Vercel (Next.js) & Local / Cloud Container (Python FastAPI) | Scalable production cloud hosting |

---

## Database Schema Overview

The database is modeled as a normalized relational schema with **14 distinct tables** managed via Prisma ORM:

| Table Name | Model Name | Description |
|---|---|---|
| `users` | `User` | Employees, Managers, and Admins with hashed credentials, roles, and department links |
| `departments` | `Department` | Organization business units with allocated monthly IT budgets and department codes |
| `vendors` | `Vendor` | SaaS software publishers and suppliers (e.g., Microsoft, Atlassian, Adobe, Figma) |
| `software` | `Software` | Software catalog classified by category, consumption type, and status |
| `licenses` | `License` | Purchased license pools, billing frequencies, seat counts, and unit costs in INR (`₹`) |
| `license_assignments` | `LicenseAssignment` | Individual seat mappings connecting employees to active licenses |
| `usage_records` | `UsageRecord` | Telemetry logs recording `lastActiveDate`, `loginCount`, `hoursUsed`, and activity status |
| `software_requests` | `SoftwareRequest` | Employee software provisioning requests with priority, reason, and status |
| `request_approvals` | `RequestApproval` | Decision records linking approvals to managers and designated fulfillment actions |
| `renewals` | `Renewal` | Contract renewal timeline, estimated costs, risk tiers, and auto-renew switches |
| `cost_records` | `CostRecord` | Historical monthly spend, wasted costs, and yearly capital recovery metrics |
| `recommendations` | `Recommendation` | AI-generated optimization recommendations with estimated monthly/annual savings |
| `alerts` | `Alert` | System, renewal, and cost notifications with severity levels (`INFO`, `WARNING`, `CRITICAL`) |
| `audit_logs` | `AuditLog` | Append-only audit trail capturing lifecycle events, actor IDs, IP, and action metadata |

---

## Project Folder Structure

```
software-license-subscription-intelligence-platform/
├── app/                                 # Next.js 14 App Router
│   ├── analytics/                       # Analytics UI views
│   │   ├── costs/page.tsx               # Financial spend, waste & capital recovery
│   │   ├── duplicates/page.tsx          # Dedicated duplicate subscription detection
│   │   └── usage/page.tsx               # 4-tier seat classification & telemetry ledger
│   ├── api/                             # REST API Route Handlers
│   │   ├── alerts/                      # Alerts and notification counters
│   │   ├── analytics/                   # Primary analytics endpoints
│   │   │   ├── consumption/             # Token/seat consumption metrics
│   │   │   ├── duplicates/              # Duplicate cluster detection & consolidation
│   │   │   ├── fastapi-proxy/           # Live microservice health bridge & proxy
│   │   │   ├── health/                  # 5-factor subscription health score
│   │   │   └── yearly-recovery/         # Multi-year investment recovery tracking
│   │   ├── assignments/                 # Seat allocation and revocation
│   │   ├── audit-logs/                  # Filterable audit trail queries
│   │   ├── auth/                        # JWT login, session check, and logout
│   │   ├── departments/                 # Department budget management
│   │   ├── licenses/                    # License inventory CRUD
│   │   ├── recommendations/             # AI recommendation generation & status
│   │   ├── renewals/                    # Contract renewal tracking
│   │   ├── reports/                     # Executive report generation
│   │   ├── requests/                    # Employee request lifecycle & approval
│   │   ├── settings/                    # Threshold & platform preference persistence
│   │   ├── software/                    # Software catalog CRUD
│   │   ├── usage-logs/                  # Telemetry ingestion & query API
│   │   ├── users/                       # User management & employee directory
│   │   └── vendors/                     # Vendor management
│   ├── approvals/page.tsx               # Manager approval queue with idle-seat pre-check
│   ├── assignments/page.tsx             # Active seat allocation manager
│   ├── audit-logs/page.tsx              # Immutable audit trail with action filter pills
│   ├── dashboard/page.tsx               # Executive KPI dashboard
│   ├── departments/page.tsx             # Department cost centers and budget adherence
│   ├── employees/page.tsx               # Employee directory & license inventory
│   ├── licenses/page.tsx                # License inventory & contract status
│   ├── login/page.tsx                   # Authentication screen with preset demo logins
│   ├── recommendations/page.tsx         # AI optimization recommendations center
│   ├── renewals/page.tsx                # Risk-tiered contract renewal governance
│   ├── reports/page.tsx                 # PDF report builder & interactive previews
│   ├── requests/page.tsx                # Employee software request submission portal
│   ├── risk-alerts/page.tsx             # Risk radar & security alert center
│   ├── settings/page.tsx                # Microservice health probe & threshold config
│   ├── software/page.tsx                # Software catalog & application registry
│   ├── vendors/page.tsx                 # Vendor directory & contact management
│   ├── globals.css                      # Tailwind CSS root styles
│   └── layout.tsx                       # Master application shell
├── components/                          # Shared UI & Component Architecture
│   ├── DashboardCharts.tsx              # Recharts data visualization widgets
│   ├── Header.tsx                       # App bar with search, alerts, and user avatar
│   ├── NotificationDropdown.tsx         # Real-time alert notification drawer
│   └── Sidebar.tsx                      # Role-aware navigation sidebar
├── context/
│   └── AuthContext.tsx                  # Client React context managing JWT sessions
├── lib/                                 # Shared Core Libraries & Business Logic
│   ├── analytics.ts                     # TypeScript vectorized analytics engine
│   ├── audit.ts                         # Immutable audit logging helper
│   ├── auth.ts                          # JWT signing, verification & RBAC guards
│   ├── exportCsv.ts                     # RFC 4180-compliant CSV export engine (UTF-8 BOM)
│   ├── prisma.ts                        # Singleton Prisma PostgreSQL client
│   └── recommendations.ts               # 5-factor health score & recommendation rules
├── prisma/
│   ├── schema.prisma                    # 14-table PostgreSQL relational schema
│   └── seed.ts                          # Comprehensive enterprise database seeder
├── python_service/                      # Python Analytics Microservice
│   ├── main.py                          # FastAPI vectorized analytics service (:8000)
│   └── requirements.txt                 # fastapi, uvicorn, pandas, numpy
├── files/                               # Academic Documentation
│   ├── FEP Final Report.docx
│   ├── FEP Project Synopsis.docx
│   └── Field Visit Report.docx
├── package.json                         # Node dependencies & npm scripts
├── tsconfig.json                        # TypeScript configuration
└── tailwind.config.ts                   # Tailwind styling configuration
```

---

## Local Setup & Installation Guide

### Prerequisites
- **Node.js**: `v20.0.0` or higher
- **npm**: `v10.0.0` or higher
- **Python**: `v3.10` or higher (optional, for FastAPI microservice)
- **PostgreSQL Database**: Neon serverless database (or local PostgreSQL instance)

### 1. Clone the Repository
```bash
git clone https://github.com/pritiudata0810-commits/Software-License-and-Subscription-Intelligence-Platform.git
cd Software-License-and-Subscription-Intelligence-Platform
```

### 2. Install Node Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Database Connection (Neon Cloud PostgreSQL)
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"

# JWT Authentication Secret
AUTH_SECRET="fep-software-license-intelligence-secure-jwt-secret-2026"

# Optional: FastAPI Microservice URL (Defaults to http://127.0.0.1:8000)
FASTAPI_SERVICE_URL="http://127.0.0.1:8000"
```

### 4. Initialize Database Schema & Seed Realistic Data
```bash
# Push Prisma schema to PostgreSQL
npx prisma db push

# Seed users, departments, vendors, software, licenses, assignments, and telemetry
npm run prisma:seed
```

### 5. Start the Next.js Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 6. (Optional) Start the Python FastAPI Microservice
In a separate terminal:
```bash
cd python_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
*Note: If the Python microservice is not started, the application automatically and gracefully operates using the built-in native TypeScript analytics engine with 100% mathematical parity.*

---

## Demo Credentials & Preset Roles

The application comes pre-loaded with realistic enterprise test accounts across all three RBAC roles. You can click the **Quick Preset Login** buttons directly on the `/login` screen to sign in instantly:

| Role | Email | Password | Privileges & Access Scope |
|---|---|---|---|
| 👑 **Admin** | `admin@enterprise.com` | `Password@123` | Full access to all modules: software & license catalog, vendor contracts, department budgets, employee directory, risk alerts, duplicate detection, settings, and immutable audit logs. |
| 👔 **Manager** | `manager.eng@enterprise.com` | `Password@123` | Departmental governance: view department spend, monitor seat efficiency, access approval queue, execute one-click **Reclaim & Approve** transactions, and review AI recommendations. |
| 👤 **Employee** | `alex.chen@enterprise.com` | `Password@123` | Personal employee workspace: view assigned licenses, monitor individual software usage, browse available software catalog, and submit software provisioning requests. |

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

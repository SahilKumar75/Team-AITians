# Deployment (production & IPFS)

Companion to **ARCHITECTURE.md**. Covers **contract deployment**, production build (no dev bypass or mock data), environment variables, and hosting the frontend so the app is **public** (not local-only).

---

## Deployment order (complete checklist)

To get from “local only” to a **live, public app**, do these in order:

| Step | What | Done? |
|------|------|--------|
| **1** | Deploy contracts to Polygon Amoy (§0) | |
| **2** | Put contract addresses in env (§2) | |
| **3** | Deploy the **Next.js app** to a public host (§3) | |
| **4** | Set **NEXTAUTH_URL** to your live URL (§2) | |
| **5** | (Optional) Verify doctors/hospitals via DefaultVerifier | |

Until **step 3**, the app only runs on your machine. To make it **public**, you must deploy the frontend (e.g. 4EVERLAND, Spheron, Pinata, or Vercel) and use that URL as `NEXTAUTH_URL`.

---

## Deployment: IPFS + Frontend (step-by-step)

**Free + decentralised (IPFS):** **4EVERLAND** ya **Spheron** use karo. Dono free tier dete hain, GitHub se build + IPFS deploy. (Fleek ab suspended; Pinata free pe limits hai.)

---

### Option 1 — 4EVERLAND (free, decentralised, recommended)

4EVERLAND GitHub se build karke **IPFS** (aur Arweave/IC) pe deploy karta hai. Free subdomain: `*.4everland.app`.

1. **https://www.4everland.org** → Sign up (GitHub / wallet).
2. **Hosting** → **New Project** → **Import Git Repository** → repo + branch select karo.
3. **Framework:** Next.js (ya Static — agar sirf `out` upload karna ho).
4. **Build:**  
   - Build command: `npm ci && npm run build`  
   - **Output directory:** `out` (Next.js static export).
5. **Environment variables** add karo (Project → Settings → Environment):
   - `NEXT_PUBLIC_USE_CLIENT_DATA` = `true`
   - `NEXT_PUBLIC_POLYGON_RPC_URL` = `https://rpc-amoy.polygon.technology`
   - `NEXT_PUBLIC_POLYGON_CHAIN_ID` = `80002`
   - `NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS` = `0x...`
   - `NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS` = `0x...`
6. **Deploy** — 4EVERLAND IPFS pe push karega. URL: `https://<name>.4everland.app` + IPFS gateway link.
7. Docs: [4EVERLAND Hosting](https://docs.4everland.org/hosting/)

---

### Option 2 — Spheron (free, decentralised)

Spheron bhi free tier pe IPFS/Web3 deploy karta hai.

1. **https://spheron.network** → Sign up (GitHub).
2. **Create Project** → **Deploy from GitHub** → repo + branch.
3. **Framework:** Next.js. Build: `npm run build`. **Publish directory:** `out` (static export).
4. **Env vars** same as above add karo.
5. **Deploy** — Spheron IPFS pe host karega, URL milega.

---

### Option 3 — Vercel (free, centralised)

Agar turant live chahiye, IPFS optional:

1. **https://vercel.com** → GitHub → Add Project → Deploy.
2. Env vars add karo. URL: `https://<project>.vercel.app`.
3. Baad mein `out/` ko 4EVERLAND/Spheron pe mirror karke decentralise kar sakte ho.

---

### Step 1: Contract addresses (agar abhi deploy nahi kiye)

Polygon Amoy pe contracts deploy karo (§0). Script ke baad print hue **IdentityRegistry** aur **HealthRegistry** addresses ko note karo.

### Step 2: Build-time env

Build se pehle yeh env set karo (`.env.production` ya terminal). Template: **`.env.example`** (copy karke values bharo).

```env
# Required for static + client-only build
NEXT_PUBLIC_USE_CLIENT_DATA=true

# Polygon (Amoy testnet)
NEXT_PUBLIC_POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_POLYGON_CHAIN_ID=80002

# Your deployed contract addresses (from §0)
NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS=0x...
```

Production mein **`NEXT_PUBLIC_DEV_BYPASS_AUTH`** mat set karo (ya `false`).

### Step 3: Static build

```bash
npm run build
```

Output **`out/`** folder mein aayega. Yehi folder IPFS pe pin karna hai.

### Step 4: Pinata pe `out/` upload karo

**Option A — Pinata Dashboard**

1. [pinata.cloud](https://pinata.cloud) → login → **Upload** → **Folder**.
2. **`out`** folder select karo (project root ka `out/`).
3. Upload ke baad **CID** copy karo.

**Option B — Script (paid Pinata plan chahiye)**

Script `out/` ko CAR file bana kar Pinata V3 pe upload karta hai. **Free plan pe CAR allowed nahi hai** — agar 403 aaye to **Option A (Dashboard)** use karo: Upload → Folder → `out` select karo.

Agar plan paid ho:
1. Pinata dashboard → **API Keys** → JWT copy, `.env` mein `PINATA_JWT` set karo.
2. Chalao: `node scripts/pin-to-pinata.mjs` (pehli baar `npx` ipfs-car install karega).

### Step 5: App ka URL

- **Pinata Gateway:** `https://<your-gateway>.mypinata.cloud/ipfs/<CID>/`  
  (Gateway subdomain Pinata dashboard mein dikhta hai.)
- **Public gateway:** `https://ipfs.io/ipfs/<CID>/`

Browser mein yeh URL kholo — app load honi chahiye. **Helia** (uploads) aur **auth** (Triple-Lock) sab browser mein chalenge; koi backend nahi.

### Step 6 (optional): IPNS

Site update karne ke baad naya CID aayega. **IPNS** use karo agar ek hi stable link chahiye; Pinata docs mein IPNS publish ka option hai.

### While POL / balance is pending

Jab faucet se POL aane ka wait ho raha ho, yeh kar sakte ho:

| Kaam | Kya karna |
|------|-----------|
| **Build ready** | `npm run build` chala chuke ho to `out/` tayyar hai. |
| **Pinata JWT** | [app.pinata.cloud](https://app.pinata.cloud) → API Keys → new key → JWT copy karke safe rakho (upload script ke liye). |
| **Contract addresses ke baad** | Deploy ke baad `node scripts/set-contracts-and-build.mjs <IdentityRegistry> <HealthRegistry>` chalao — yeh `.env.production` update karke `npm run build` chala dega. Phir Pinata pe `out/` upload karo. |

---

## 0. Deploy contracts (do this first)

Per **ARCHITECTURE.md**, deploy **IdentityRegistry** and **HealthRegistry** to **Polygon Amoy** before running the app in production.

### Prerequisites

1. **Wallet with test POL** on Polygon Amoy:
   - Get testnet POL from the [Polygon faucet](https://faucet.polygon.technology/) (select Amoy).
2. **Deployer private key** in env (never commit this):
   ```bash
   export DEPLOYER_PRIVATE_KEY=0x...   # your wallet private key
   ```
   Optional: `POLYGON_RPC_URL` (default: `https://rpc-amoy.polygon.technology`).

### Deploy

```bash
# Compile (first time may download Solidity 0.8.24)
npx hardhat compile

# Deploy to Amoy
npm run chain:deploy
```

This deploys in order: **DefaultVerifier** → **IdentityRegistry(verifier)** → **HealthRegistry(verifier)** → calls **HealthRegistry.setIdentityRegistry(identityRegistry)** so guardian veto works.

### After deploy

The script prints the deployed addresses. Option A: add them to `.env.production` and run `npm run build`. Option B (one command):

```bash
node scripts/set-contracts-and-build.mjs <IdentityRegistry> <HealthRegistry>
```

Yeh `.env.production` update karke `npm run build` chala dega. Phir Pinata pe `out/` upload karo.

**Verifying doctors/hospitals:** The deployer is the admin of **DefaultVerifier**. Call `verifier.verify(doctorOrHospitalAddress)` for each doctor/hospital wallet that should be able to add records or request access. You can do this from the same deployer wallet (e.g. via Hardhat console or a small script).

---

## 1. Production build: no dev bypass or mock data

- **Dev bypass** and **mock data** are **never active in production**. They are gated by `NODE_ENV`: only when `NODE_ENV === 'development'` and `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` can bypass run (see `src/lib/dev-utils.ts`).
- For production:
  - Run `npm run build` with **`NODE_ENV=production`** (default for `next build`).
  - **Do not set** `NEXT_PUBLIC_DEV_BYPASS_AUTH` in production, or set it to `false`. Never set it to `true` in production.
  - Do not rely on `NEXT_PUBLIC_DEV_ROLE` in production; it is only used when dev bypass is on.
- The patient upload API (`/api/patient/upload`) does **not** return a mock CID in production; if IPFS is not configured there, it returns 503. In production, uploads go through **Helia in the browser** (see ARCHITECTURE and DATA_STORAGE_AND_JOURNEY).

---

## 2. Environment variables for production

Set these where you run the app (e.g. Fleek, or your host):

```env
# Polygon (example: Amoy testnet)
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_POLYGON_CHAIN_ID=80002

# Deployed contracts (replace with your deployed addresses)
NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS=0x...

# NextAuth (required if using API auth)
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=<strong-random-secret>

# Optional: SMS (e.g. Fast2SMS for emergency notifications)
FAST2SMS_API_KEY=<your-key>
```

- **Do not set** `NEXT_PUBLIC_DEV_BYPASS_AUTH` or set it to `false`.
- **Do not set** `IPFS_API_URL` unless you run a Kubo (or compatible) node for server-side pinning; the app uses **Helia in the browser** for uploads per ARCHITECTURE.

---

## 3. Hosting the app (make it public, not local)

To get off **local only**, deploy the Next.js app to a **public host**. Then set `NEXTAUTH_URL` to your live URL (e.g. `https://your-app.fleek.app` or `https://your-app.vercel.app`). Until you do this, the app only runs on your machine.

### Option A: 4EVERLAND (free, decentralised, IPFS)

Fleek ab suspended. **4EVERLAND** use karo (free tier, GitHub → IPFS). Steps: see **Option 1 — 4EVERLAND** above. Publish directory: **out**.

| Layer              | Tool        | Note                    |
|--------------------|-------------|-------------------------|
| Frontend + API     | **Fleek.co** | Next.js → IPFS          |
| Domain/URL        | IPNS via Fleek | Optional custom domain |

**Branch to use:** Connect the repo and select branch **`feat/frontend-migration`** (or your main deployment branch).

**Steps:**

1. Connect your Git repo to [Fleek](https://fleek.co) (or try [app.fleek.co](https://app.fleek.co) / [fleek.xyz](https://fleek.xyz) if fleek.co is down).
2. Add a new site; framework: **Next.js**.
3. Build command: `npm ci && npm run build`. Publish directory: use Fleek’s default for Next.js (e.g. `.next`).
4. In Fleek **Environment variables**, add all vars from §2 (contract addresses, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, etc.). Do **not** set `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`.
5. Deploy. Fleek will give you a public URL. Set `NEXTAUTH_URL` to that URL in Fleek’s env and redeploy if needed.
6. See [Fleek Docs – Site Deployment](https://docs.fleek.co/hosting/site-deployment/) for IPNS/custom domain.

---

### Option A2: Spheron Network (free, decentralised, IPFS)

[Spheron](https://spheron.network): Web3 PaaS, deploys to **IPFS**, free tier.

| Layer        | Tool       | Note                          |
|-------------|------------|-------------------------------|
| Frontend    | **Spheron** | Next.js → IPFS / decentralised |
| URL         | Spheron    | They provide a public URL     |

**Branch to use:** **`feat/frontend-migration`** (or your main deployment branch).

**Steps:**

1. Go to [spheron.network](https://spheron.network) and sign up (e.g. with GitHub).
2. **Create new project** → **Deploy from GitHub** → select **SahilKumar75/SWATHYA-SANCHAR** and branch **`feat/frontend-migration`**.
3. **Framework:** Next.js. Spheron will detect it. Set **build command** to `npm run build` (or `npm ci && npm run build`). **Publish directory:** `.next` for full Next.js, or `out` if you use static export.
4. **Environment variables:** Add all from §2 (contract addresses, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_POLYGON_CHAIN_ID=80002`). Do **not** set `NEXT_PUBLIC_DEV_BYPASS_AUTH`.
5. **Deploy.** Spheron will build and deploy to IPFS (or their edge). Copy the public URL they give you, set `NEXTAUTH_URL` to it in Spheron’s env, and redeploy once if needed.
6. For **full Next.js with API routes**, use their standard Next.js flow. For **static export only**, set build to produce `out/` and set publish directory to `out`. See [Spheron docs](https://docs.spheron.network) for latest UI.

### Option B: Vercel (quickest way to go public)

If you want to get online fast (ARCHITECTURE prefers Fleek for decentralisation; Vercel is centralised but simple):

1. Push your code to **GitHub**.
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import your repo.
3. Framework: **Next.js** (auto-detected). Build command: `npm run build`. Leave defaults.
4. **Environment variables:** add everything from §2. Set `NEXTAUTH_URL` to `https://your-project.vercel.app` (or your custom domain). Do **not** set `NEXT_PUBLIC_DEV_BYPASS_AUTH`.
5. Deploy. Vercel gives you a public URL. Update `NEXTAUTH_URL` to that URL if needed and redeploy.

### Option C: Static export for IPFS-only frontend

If you want a **static** frontend (no server) on IPFS:

1. **Enable static export** in `next.config.mjs`:
   - Add `output: 'export'` to the `nextConfig` object.
2. **Remove** `export const dynamic = 'force-dynamic'` from:
   - `src/app/layout.tsx`
   - `src/app/doctor/layout.tsx`
3. **Build**: `npm run build`. Output will be in the `out/` directory.
4. **Publish** the `out/` directory to IPFS (e.g. via Fleek: set build to `npm run build` and publish directory to `out`).

**Limitations of static export:**

- **API routes** (e.g. `/api/auth/*`, `/api/patient/upload`) **will not run** on IPFS; they require a Node server. For auth and uploads you rely on client-side flows (e.g. Helia in the browser for uploads; auth may need a separate backend or client-only flow).
- NextAuth’s API routes need a server; for static export you’d need to move to client-only auth or a separate auth service.

### Option A3: Pinata (Fleek/Spheron alternative — decentralised, IPFS)

[Pinata](https://pinata.cloud) offers **IPFS pinning** and **Next.js deployment to IPFS**, so you can host the app on their infrastructure and get a public gateway URL.

| Layer        | Tool      | Note                                |
|-------------|-----------|-------------------------------------|
| Frontend    | **Pinata** | Next.js → IPFS (see Pinata Next.js docs) |
| URL         | Pinata    | Dedicated gateway (e.g. `*.mypinata.cloud`) |

**Branch to use:** **`feat/frontend-migration`** (or your main deployment branch).

**Steps:**

1. Sign up at [pinata.cloud](https://pinata.cloud) and open the dashboard.
2. Create an **API key** (Admin level for full access). Copy your **JWT** and note your **Gateway** URL (e.g. `https://your-subdomain.mypinata.cloud`).
3. **Deploy the app to IPFS:**
   - See [Pinata Docs – Next.js](https://docs.pinata.cloud/frameworks/next-js) for their recommended flow (e.g. `create-pinata-app` for new projects, or build + upload/pin for existing apps).
   - For this repo: build with `npm run build`. If Pinata expects a static export, use Option C to produce `out/`, then **pin the `out/` directory** via Pinata (dashboard upload or [Pinata SDK](https://www.npmjs.com/package/pinata)) and use your dedicated gateway URL to access the site (e.g. `https://your-subdomain.mypinata.cloud/ipfs/<CID>/`).
   - If Pinata supports **Git-based deploy** (like Fleek/Spheron), connect **SahilKumar75/SWATHYA-SANCHAR**, branch **`feat/frontend-migration`**, set build to `npm run build`, and add env vars there.
4. **Environment variables:** Wherever the app is built (CI or Pinata), add all from §2. Set `NEXTAUTH_URL` to your **final Pinata gateway URL** (e.g. `https://your-subdomain.mypinata.cloud/ipfs/<CID>` or the URL Pinata gives you).
5. **Static export caveat:** If you pin only the `out/` folder (static export), API routes and NextAuth will not run; use client-side auth and Helia for uploads (see Option C). For full Next.js with API routes, use Pinata’s Next.js deployment flow if they provide a Node runtime; otherwise host the app on Vercel and use Pinata only for **pinning** (e.g. pinning uploads or the built assets).

**Uploads in this app:** Per ARCHITECTURE, **patient uploads** use **Helia in the browser**; you do not need Pinata for uploads unless you add a server-side pinning step. Pinata here is for **hosting** the site (or for optional backup pinning of content).

Use **Option A** (Fleek), **Option A2** (Spheron), **Option A3** (Pinata), or **Option B** (Vercel) if you need API routes and NextAuth. Use **Option C** only if you want a purely static frontend on IPFS and have adjusted auth/APIs accordingly.

---

## 4. Checklist before going live

- [ ] `NODE_ENV=production` for build and runtime.
- [ ] `NEXT_PUBLIC_DEV_BYPASS_AUTH` unset or `false` in production.
- [ ] Production env vars set (§2); contract addresses and RPC point to the correct network.
- [ ] No mock CIDs or test credentials in production (handled by §1 and upload API).
- [ ] If using Fleek/Spheron/Pinata/Vercel: build command and env vars are set; `NEXTAUTH_URL` is your live URL.

---

## 5. Path to fully decentralised

Right now two things are still centralised: **(1)** who runs the app (Fleek/Vercel) and **(2)** auth (NextAuth API). To get **fully** decentralised you need to change both.

### 5.1 Decentralise hosting (frontend)

**Goal:** The app is just static files on IPFS; no single company runs “the server.”

1. **Static export** the Next.js app (see Option C in §3): add `output: 'export'`, remove `force-dynamic`, build → `out/` folder.
2. **Publish `out/` to IPFS** from your own node or any pinning service (Fleek, Pinata, web3.storage, or a self-run Helia/Kubo node). Get the root CID.
3. **Access** via any public gateway (e.g. `https://ipfs.io/ipfs/<CID>/`) or IPNS. Users can also run their own node and open the CID locally. No single domain or company is required.

Result: the frontend is content-addressed and can be re-served by anyone; no central “host.”

### 5.2 Decentralise auth (no NextAuth API)

**Goal:** No server-side auth; identity = wallet + on-chain (IdentityRegistry). “Login” = prove you control the wallet.

1. **Remove NextAuth** (and `/api/auth/*`). You no longer need email/password sessions on a server.
2. **Use wallet-based auth only**, for example:
   - **Sign-In with Ethereum (SIWE):** user signs a message; frontend verifies the signature and treats that wallet as the identity. No API call for login. Optionally store a short-lived token client-side (e.g. localStorage) keyed by wallet.
   - **Or** your existing **Triple-Lock** flow: user unlocks with password (client-side) → private key used only in the browser; frontend reads identity from IdentityRegistry by `walletToIdentifier(wallet)`. No auth API at all.
3. **Session** = “we have a wallet (and optionally a signed message or client-side unlock)” in the frontend. All permission checks use the wallet + blockchain (IdentityRegistry, HealthRegistry). No central auth server.

Result: no central auth provider; identity and permissions are on-chain and in the client.

### 5.3 Summary: fully decentralised stack

| Layer        | Current (partially centralised) | Fully decentralised                          |
|-------------|----------------------------------|----------------------------------------------|
| **Frontend**| Fleek/Vercel serves the app      | Static export on IPFS; any gateway or local  |
| **Auth**    | NextAuth API (central server)    | Wallet + SIWE or Triple-Lock (client-only)   |
| **Data**    | Helia in browser, IPFS           | Same (already decentralised)                 |
| **Identity**| Polygon (IdentityRegistry)       | Same (already decentralised)                  |

Implementing §5.1 + §5.2 is a significant change (static export + refactor away from NextAuth). You can do 5.1 first (static site on IPFS) and keep a minimal auth API elsewhere if needed, then move to 5.2 to remove that last central dependency.

---

## 6. Helia vs Fleek (can I use Helia instead of Fleek?)

**No.** They do different jobs:

| | **Helia** | **Fleek** |
|---|-----------|-----------|
| **What it is** | IPFS client (library) that runs in the browser or Node | Hosting platform that builds and deploys your app |
| **Role in your app** | **Data:** upload/fetch files to IPFS (you already use it in `src/lib/helia.ts` for patient uploads) | **App itself:** build Next.js, put it on IPFS/edge, give you a public URL |
| **Replaces the other?** | No — Helia doesn’t host a website | No — Fleek doesn’t run inside your app to pin files |

**Use both:** A host (Fleek, Spheron, Pinata, or Vercel) serves the app so users can open it at a URL. Helia runs inside that app so users can pin and fetch content on IPFS. Helia is for the data layer once the site is loaded; Pinata can be used either as that host (Option A3) or only for pinning/storage if you host elsewhere.

---

## 7. How to make it fully decentralised and host on IPFS

Yes. You can have a **fully decentralised** app and **host it** in a decentralised way (no single company as host). The app already has most of what you need: **auth is client-only** (Triple-Lock in `AuthContext`), and **uploads** use **Helia** in the browser. What’s left is (1) serving the app as static files on IPFS and (2) moving any remaining server dependency to the client.

### 7.1 Steps in order

| Step | What to do |
|------|------------|
| **1** | **Static export** so the app is just HTML/JS/CSS with no Node server. |
| **2** | **Remove server-only usage** so the static build works: remove `force-dynamic`, and replace or stub every `/api/*` call with client-side logic (contracts, Helia, or local state). |
| **3** | **Auth** is already client-only (Triple-Lock in `AuthContext`). Remove or do not mount NextAuth API routes; you don’t need them for login. |
| **4** | **Build** → `out/` directory. **Pin `out/` to IPFS** (Pinata, Fleek, web3.storage, or your own node). |
| **5** | **Access** via any public gateway (e.g. `https://ipfs.io/ipfs/<CID>/`) or your Pinata gateway. Optionally use **IPNS** so you can update the site and keep a stable name. |

Result: the frontend is content-addressed; no single company runs “the server”; auth and data are already client/chain/IPFS.

### 7.2 Enable static export

1. In **`next.config.mjs`**, add to the `nextConfig` object (e.g. after `webpack`):
   ```js
   output: 'export',
   ```
2. Remove `export const dynamic = 'force-dynamic'` from:
   - `src/app/layout.tsx`
   - `src/app/doctor/layout.tsx`
3. **Set** `NEXT_PUBLIC_USE_CLIENT_DATA=true` in your build env so the app uses the client-data layer (localStorage, chain, Helia) and does not call `/api/*` at runtime.
4. Run `npm run build`. The app will be written to **`out/`**.  
   Note: with `output: 'export'`, **API routes do not run**; any `fetch('/api/...')` in the app will 404 unless you replace it with client-side logic.

### 7.3 Replace API usage with client-only logic

Today the app calls many **`/api/*`** endpoints (e.g. `/api/doctor/profile`, `/api/patient/status`, `/api/journey`, `/api/hospitals`, `/api/records`, etc.). For a static, fully decentralised build you have two paths:

- **Option A – Full migration:** For each feature, replace the API with:
  - **Identity / permissions:** Read from **IdentityRegistry** and **HealthRegistry** on Polygon (using the wallet from `AuthContext` and `getSigner()`).
  - **Profile / preferences:** Store in **localStorage** or **IndexedDB** (keyed by wallet).
  - **Records / journeys:** Store metadata on-chain or in a decentralised store; files stay in **Helia** (already in place).
  - **Hospitals / doctors list:** Either on-chain registry data or a static list / config in the app.
- **Option B – Minimal static “lite”:** Keep only flows that already work without a server: **login with Triple-Lock**, **patient upload via Helia**, **wallet-based identity**. Comment out or hide pages that depend on `/api/*` until you migrate them (Option A).

Start with **Option B** to get a static build that runs on IPFS; then migrate features to Option A over time.

### 7.4 Host the static site on IPFS

1. After `npm run build`, you have an **`out/`** folder.
2. **Upload/pin** the entire `out/` directory to IPFS:
   - **Pinata:** Dashboard → Upload folder, or use [Pinata SDK](https://www.npmjs.com/package/pinata) to pin `out/`. Use your dedicated gateway (e.g. `https://your-subdomain.mypinata.cloud/ipfs/<CID>/`).
   - **Fleek / Spheron:** Create a site that builds with `output: 'export'` and publish directory `out` (they’ll pin it).
   - **Own node:** `ipfs add -r out` → use the root CID with any public gateway (e.g. `https://ipfs.io/ipfs/<CID>/`).
3. **(Optional) IPNS:** Publish the root CID to an IPNS name so you can update the site and keep one stable link. Many pinning providers support IPNS.

You are not tied to a single host: the same `out/` can be pinned by anyone; users can open the app via any gateway or their own node.

### 7.5 Where each piece runs (Helia, device, blockchain, Pinata)

| Piece | What it is | Where it runs / lives |
|-------|------------|------------------------|
| **IPFS / Helia** | IPFS client (add/fetch content by CID) | **User’s device (browser).** Helia runs in the user’s tab; uploads go from their browser onto the IPFS network. The CID is shared; the bytes are on IPFS. |
| **Blockchain** | IdentityRegistry, HealthRegistry, DefaultVerifier | **Deployed on Polygon** (e.g. Amoy testnet). The chain runs on the network; the user’s device connects via RPC (wallet + `getSigner()` from AuthContext). |
| **Pinata** | IPFS **pinning** service | Their nodes. Pinata is **also IPFS** — they run nodes and “pin” CIDs so content stays stored and available. Same protocol as Helia; different role: Helia = client on user device, Pinata = persistent pinner. |

**Using Helia + Pinata together:** User uploads via **Helia** in the browser → you get a CID. You can then **pin that CID on Pinata** (e.g. from the client with a Pinata API key, or a tiny backend). Result: content is on IPFS from the user (Helia) and also stored by Pinata → **better availability** when the user closes the browser. Still the same IPFS content; anyone else can pin the same CID too.

**Static app (frontend):** Build → `out/` → pin **that folder** to IPFS (e.g. via Pinata). Users open the app via any gateway (Pinata, ipfs.io, or their own node). So: **hosting** = IPFS; Pinata is one way to pin the site.

### 7.6 Pinata also IPFS — is it better? Truly decentralised?

**Pinata is IPFS.** Using Pinata doesn’t change the protocol; it adds a **pinning** layer so CIDs stay available.

- **Helia only (no Pinata):** Content is on IPFS from the user’s browser. Availability depends on who has the data (browser until closed, then only caches or other nodes that fetched it). **Fully decentralised**; durability can be lower unless others pin.
- **Helia + Pinata:** Same CIDs, same IPFS. You ask Pinata to **pin** those CIDs so their nodes hold the content. **Better durability and availability.** The content is still just IPFS; anyone can pin the same CIDs (another pinner, your own node, users). The only “central” part is **relying on Pinata** for availability — but the data isn’t locked in; it’s content-addressed and replicable.

**Is it truly decentralised?** Yes, for the full Option A stack:

| Layer | Role | Decentralised? |
|-------|------|----------------|
| **Frontend** | Static app on IPFS (e.g. `out/` pinned via Pinata) | Yes — same files can be pinned and served by anyone (Pinata, Fleek, ipfs.io, user’s node). No single required host. |
| **Auth / identity** | Wallet + Triple-Lock; IdentityRegistry, HealthRegistry on Polygon | Yes — no central auth server; identity and permissions on-chain. |
| **Data (files)** | Helia in browser → IPFS; optionally Pinata pins CIDs | Yes — content is IPFS (CID-based). Pinata is one pinner; protocol is open, data can be replicated elsewhere. |
| **Blockchain** | Polygon (Amoy/mainnet) | Yes — public chain; many nodes. |

So: **IPFS on Helia** = user’s device. **Deployed blockchain** = Polygon. **Pinata** = IPFS pinning (optional, for durability). Using Pinata for pinning (site or upload CIDs) is **compatible with full decentralisation** and often **better** for availability; the stack remains truly decentralised.

### 7.7 Summary

| Goal | What you do |
|------|-------------|
| **Fully decentralised** | Static export + client-only auth (Triple-Lock) + client-only data (contracts + Helia + local). No NextAuth API; no mandatory server. |
| **Host decentralised** | Build → `out/` → pin to IPFS (Pinata, Fleek, or your node) → share gateway URL or IPNS. No single company owns “the host.” |
| **Data durability** | Optional: after Helia uploads, pin the returned CIDs on Pinata (or another pinner). Same IPFS; better availability; still decentralised. |

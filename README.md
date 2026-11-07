# KUZMIN — Carbon motorcycle collection

Next.js App Router, React, TypeScript, Tailwind CSS and Supabase. Visual direction follows the supplied Framer references: near-black editorial layouts, restrained navigation, oversized type, three marque cards and generous spacing. The public storefront currently uses Turkish only, with no language selector. Stored English/Russian translations are retained for a future reactivation through supportedLanguages in src/lib/settings.ts. KUZMIN is a working identity taken from the reference, not a claim about a registered business.

## Visual-first browser workspace

[Open the design workspace](https://htmlpreview.github.io/?https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/main/docs/panel.html#onizleme). It opens directly on the finished storefront appearance, with a page picker and desktop/tablet/mobile widths. It requires no installation or account. `Veri paneli` opens the existing catalog forms. The host is a third-party preview service, not the authenticated production admin.

The preview bundles the **actual `Storefront` React component and site stylesheet**, with navigation and image adapters for static hosting. All storefront screens are available: home, brand/model/year selection, exact fitment results, catalog, product details, filled/empty cart, order request layout, about/contact/FAQ/shipping/privacy/terms. It displays Turkish and reflects the current browser's catalog drafts and uploaded images. Preview cart state is in memory; checkout fields and real order submission are disabled. No customer data, runtime credentials, or local database is read or exposed.

`Düzenleme modu` starts enabled. Click a text to edit it in place (plain text leaves) or in the right inspector; changes save immediately and update the same iframe without losing scroll. Click the banner, a homepage mosaic slot, brand, model or product photo to upload JPEG/PNG/WebP (5 MB maximum). Images are resized locally. Product/model/content fields update the existing catalog; interface copy and editorial images use a separate `.design` storage record. Language-specific edits retain the other languages. Calculated fields and complex records remain accessible through their full forms. The collapsible change-note area identifies the section for layout requests in chat. Turn editing off for ordinary navigation.

The homepage contains a banner with one headline/CTA and eight asymmetric photo slots; editorial copy, section numbering, homepage brand/product listings and the craftsmanship section are removed. Gallery slots start empty for owner-supplied photography. Click a slot in editing mode and use **Yeni fotoğraf seç**; plus icons appear only while editing. Existing `home.collection.body`, `home.collection.details` and `home.craft` uploads are reused in the first three slots; five new `home.gallery.*` slots save independently. Photos fill their frames and the mosaic adapts to desktop/tablet/mobile. Existing catalog, text drafts and unrelated images are preserved. `scripts/test-direct-editor.mjs` verifies gallery uploads, reload and customer-tab synchronization.

`Müşteri önizlemesi ↗` opens [the clean customer view](https://htmlpreview.github.io/?https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/main/docs/store.html#/). It uses the same React storefront without editor controls, with shareable hash routes, normal navigation/back, and a separate persistent demo cart. Editor changes sync to the customer tab through browser storage events. Tabs must use the same browser/profile and preview origin to share drafts. Another device or private window receives the default demo catalog, not the owner's local changes. Checkout remains a labelled preview with real order submission disabled.

For brand logos, click the logo in editing mode and use **Logo ölçeği** (50–200%). Each brand has its own saved percentage; **Varsayılan boyuta dön** restores 100%. Scaling applies to both built-in and uploaded logos, preserves their proportions and leaves caption positions fixed. Values live in the existing visual draft and JSON backup, with live customer-tab updates. `node scripts/test-logo-scale.mjs` covers persistence, per-brand settings, upload/reset and backup/import.

Logo editing also offers **Hizalama kılavuzu**: toggleable top/center/bottom and center-axis ghost guides, visible only in editing mode while a brand logo is selected. Close them with the overlay × or sidebar checkbox; this editor preference is saved separately from the design and never appears in customer view. **Hepsini hizala** uses the selected logo’s visible height, centers all logos, and saves scale/offset values together. Transparent image padding and CSS logo shapes are measured. Where 50–200% bounds limit equalization, the inspector reports this. Alignment offsets are included in existing JSON backups. Validate with `node scripts/test-logo-guides.mjs` and `tests/logo-alignment.test.ts`.

After a design change run `npm run panel:build` and publish `docs/panel.html`, `docs/store.html` and `docs/panel-version.json` atomically. An active browser checks the public version every eight seconds and on focus, then loads the new source while retaining the selected page/device and catalog drafts. Open edit forms, active inline text editing and unsaved invalid values defer updates. `Güncel tasarımı yükle` is a manual refresh. Explicit copy edits can be carried as one-time public catalog patches in `quick-panel/content-updates.json`, preserving unrelated and later owner changes.

This remains a **public draft workspace**, separate from the authenticated production admin and live store data. It saves catalog edits in browser local storage and supports JSON backup/import, including visual copy/photo edits; older catalog-only backups remain supported. Do not enter customer details or secrets, and export before clearing browser data or using another device. The quick model form supports one generation per model and rejects multi-generation restructuring; the full relational production admin remains in the Next.js application.

`node scripts/test-direct-editor.mjs` verifies in-place/sidebar editing, photo replacement, persistence, customer tab sync and the customer cart journey. Set `TEST_PROVIDER=1` to simulate HTMLPreview transport for both tabs.

For developer validation, serve the repository with `python3 -m http.server 4173 --bind 127.0.0.1`. `node scripts/test-quick-panel.mjs` covers catalog CRUD/photos/backup/import; `node scripts/test-site-preview.mjs` covers all storefront screens, responsive devices, Turkish-only display, section inspection, copy and draft editing; `node scripts/test-preview-updates.mjs` simulates the provider's transport to verify automatic design refresh, protected unsaved forms and one-time copy updates. Tests do not establish the external provider's availability. The public HTMLPreview script transformation is compatible with the generated single inline script and runtime-created iframe.

## Membership, journal and shipment tracking

The header includes Blog before Contact and a single My Account link. Collection is omitted from header/footer menus; Track Shipment appears in the footer alongside Terms. Browsing/cart are public; checkout, the order API and Supabase order RPC require a verified customer. Customers see only their own order history under My Account. Customer authentication is separate from staff authorization. Configure Supabase Email confirmation, Site URL, callback allowlist (`/auth/callback`) and production SMTP before using real accounts. The local demo uses hashed customer passwords and signed HttpOnly sessions without email verification; the install-free preview uses an explicit sample member without collecting credentials.

Blog articles use existing content rows with `blog-<slug>` keys. Both panels offer Blog yazısı ekle. Each post has an editable image banner with an overlaid title; cards wrap into asymmetric rows, give long headings more space and stack on mobile. Lists paginate after ten posts with shareable `?page=2` URLs and preserve the originating page when returning from an article. Covers use stable `blog:<content-id>` visual bindings, are shared by list/detail views, and survive design backup/publishing. Click the image in editing mode to upload a replacement; clicking the heading edits its text. No sample articles are inserted into the default catalog. `scripts/test-blog-banners.mjs` and its `--app` mode verify pagination, cover persistence/publishing and responsive headings. Shipment tracking is a configurable redirect to an official carrier URL, with optional `{tracking}` substitution; it shows an unconfigured state until a carrier is chosen. Configure it under the visual workspace's Taslak & yedek or the authenticated admin's Yapılandırma. No carrier API, shipment status feed or secret is invented. Read the [Turkish owner/setup guide](docs/UYELIK-BLOG-KARGO.md).

Tests: `node scripts/test-member-preview.mjs` exercises the new preview flows; `tests/customer.spec.ts` checks server membership/session/order ownership, and the PostgreSQL test applies both migrations and checks anonymous/direct-RPC bypass, verified email and customer isolation.

## Windows source download

The current local source package is [`downloads/KUZMIN-Kaynak.zip`](downloads/KUZMIN-Kaynak.zip). Install Node.js 24 or a newer LTS release from [the official Node.js site](https://nodejs.org/en/download), extract the source package, open Command Prompt in that folder, and run `npm.cmd run kurulum`. Then run `npm.cmd run local` and copy the printed store or admin URL into your browser. No hosting account is required. Read `BASLAMADAN-ONCE.txt` for the Turkish walkthrough.

The previous automatic Windows package was withdrawn after a reported download security warning. The reported browser text did not identify a particular threat. We removed its PowerShell bootstrap, execution-policy override, bundled batch launchers and Windows shell-based browser opening. These changes are not an antivirus verdict or a claim that the warning was a false positive. If Windows blocks the replacement package, stop rather than overriding protection.

## Run locally

Node.js **24 or newer** is required (local demo uses Node's built-in SQLite).

```bash
npm ci
npm run setup:demo
npm run dev
```

Open the application on port 3000. `/admin` is the visual administration dashboard. Local login email: `demo@local.test`. The generated password is the `LOCAL_ADMIN_PASSWORD` entry in your private `.env.local` file. It is not committed or printed by setup. Keep this file private. `setup:demo` preserves an existing file; use `.env.example` to complete missing entries if you already have one.

The local relational database is `.data/store.sqlite`. Image uploads go to ignored `public/uploads/`. These files persist across server restarts; back them up if needed. SQLite is a local demonstration adapter, not the production database. Local admin auth is disabled on Vercel and local demo requires explicit `ALLOW_LOCAL_DEMO=true` under `npm start` (generated by setup). Do not enable it on a publicly exposed production server.

## What works

- Exactly Ducati, BMW and Yamaha, with editable models, generations and individual production years.
- `/motosikletler/yamaha/mt-25/2024`: shareable compatibility selections, breadcrumb navigation and remembered motorcycle.
- Relational many-to-many fitment, including optional generation and inclusive year ranges. Only registered model years can be selected. One product can match multiple brands/models.
- Searchable catalog with category, material, availability and price sorting; product galleries, finish variants, inventory limits, specifications and compatibility details.
- Cart persists locally, including across language changes and tabs. With payment disabled, checkout records an order **request**, with authoritative variant prices and stock validation on the server. Enabled hosted payments reserve inventory and require verified provider results, as described in the payment guide.
- Password-protected visual administration: models/photos, generations/years, products/translations, variants/prices/stock, multiple image records/uploads, compatibility, categories, featured status, page copy and order status.
- `admin` and `editor` roles; editors manage content, administrators additionally delete records and manage orders. Roles cannot be self-assigned through the website.
- About, Contact, FAQ, Shipping & Returns, Privacy and Terms are database-driven editable pages. They contain explicit content placeholders until the owner supplies approved text.
- Product metadata, configurable canonical origin, multilingual sitemap and robots. Indexing is deliberately disabled by default for the demonstration.

## Use Supabase / deploy to Vercel

1. Create a Supabase project. Run [`supabase/migrations/001_store.sql`](supabase/migrations/001_store.sql), then [`supabase/migrations/002_customer_membership.sql`](supabase/migrations/002_customer_membership.sql) in SQL Editor (or with your Supabase migration workflow) on a new database. These migrations create tables, constraints, RLS, role helpers, the atomic order-request RPC and the public `catalog` image bucket.
2. Optionally run [`supabase/seed.sql`](supabase/seed.sql). All products, prices, inventory, generations and compatibility entries are **demonstration data**, not verified commercial facts. The three supported brands are seeded here too. If importing real data instead, insert these three brand rows first.
3. In Supabase Authentication, create the owner's user securely. Disable public sign-ups for this owner-only dashboard. Assign the user's actual Auth UUID through SQL Editor:

   ```sql
   insert into public.admin_users(user_id, role)
   values ('YOUR_ACTUAL_AUTH_USER_UUID', 'admin');
   ```

   Use `editor` for a content-only account. The website does not create roles or accept role information from user metadata.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the project's public anon/publishable key) in your local `.env.local` or Vercel project settings. The public key is safe only with the supplied RLS policies. The application never needs a service-role key. The server uses the signed-in user's session for administrative requests. Session refresh is handled by `src/proxy.ts`; each administrative API independently checks the role.
5. Set `NEXT_PUBLIC_SITE_URL` to your verified HTTPS production origin. Review the owner-managed legal/commercial pages, verified inventory, fitments, shipping/tax terms and licensed real assets before launch. Set `ENABLE_INDEXING=true` only when ready to be indexed. Preview deployments should leave it false. Preview order/admin POSTs require their own configured origin or an unset canonical origin; the origin check is intentionally strict.
6. Import the repository into Vercel using the Next.js preset and Node 24. Build: `npm run build`. No SQLite database, local password or filesystem upload persistence is used on Vercel. Images upload to Supabase Storage. No deployment or remote Supabase mutation has been performed by this task.
7. Verify the live Auth, RLS, Storage upload and order journey against your own Supabase project before accepting customer information. Local PostgreSQL tests do not establish actual Supabase/Vercel credentials or connectivity.

## Owner workflow (no source edits)

See [the Turkish owner guide](docs/OWNER-GUIDE.md). The dashboard's overview also presents the sequence. Create a model → create its generation → register individual years → create product → create its priced/in-stock variants → add image records → add one fitment record per model/year range. Set product visibility and featured status explicitly. A product needs at least one variant to be added to the bag. Product-level stock caps the total of all variants; variant stock caps that finish. Enter translations using the TR/EN/RU tabs.

To add multiple photographs, create multiple image records for the same product and assign increasing positions (0 is the cover). The existing upload field accepts JPEG, PNG and WebP up to 5 MB; it checks file signatures and creates random filenames. SVG uploads are intentionally rejected.

## Validation

```bash
npm run typecheck
npm test
npm run build
# Start the server separately, then:
npm run test:e2e
```

`npm test`: 5 domain/validation tests plus 1 PostgreSQL integration test using PGlite (real PostgreSQL compiled to WASM). The integration test applies the actual migration/seed against Auth/Storage schema stubs and exercises RLS, role escalation protection, order pricing, stock, consent and relational constraints. It does not test the hosted Supabase service itself.

The five Playwright tests exercise the full customer journey, language/cart persistence, order request creation, unauthorized access, owner login/model/year/product/variant/image/fitment creation, order updates, mobile navigation, filtering and authenticated configuration edits. They require an explicitly configured **local demo** instance and generated local credentials. They write labeled demo order requests and clean their temporary catalog records. Do not run this suite against a production merchant database. Chromium is expected at `/usr/bin/chromium` in this cloud environment; elsewhere install Playwright Chromium and set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable. Set `TEST_BASE_URL` to test another local port.

## Architecture and boundaries

- `src/app/[[...slug]]/page.tsx`: validates routes and loads the server-side catalog; unknown brands/models/years/products return 404.
- `src/lib/catalog.ts`: server-only data access; Supabase reads use ranges to avoid the default 1,000-row truncation. The current UI loads the catalog into memory for interactive filtering. For a very large inventory, add server-side search, pagination and targeted route queries before scaling; the relational schema does not require new collections.
- `src/lib/commerce.ts`: testable compatibility and quote rules; local order creation uses a database transaction. Hosted orders use the PostgreSQL RPC, which independently validates and calculates totals. Requests do not promise delivery, reserve inventory, take payment or send email.
- `src/app/api/*`: server-side input validation, cookie authentication, role checks and same-origin mutation checks. No private credentials are bundled into clients. API traffic and session data must stay HTTPS in production.
- `src/lib/settings.ts`: central currency/default-language settings; currently TRY. Adding currencies also requires updating the database/RPC currency constraints and money precision policy together.
- Login/order API burst limits are in-process; the hosted RPC also limits requests by email. Configure platform/WAF distributed rate limiting and monitoring before a public launch. Order-request totals exclude unprovided shipping/tax charges and are subject to business confirmation.
- PayTR and iyzico hosted-checkout adapters are implemented and disabled by default. Apply migration 006, configure server-only merchant credentials and the Supabase service role, then use the authenticated payment settings. Payment results require provider verification; client redirects cannot mark an order paid. See [payment setup](docs/ODEME.md). Actual provider sandbox acceptance still requires merchant credentials.
- Optional video and 360° fields open provided HTTPS media in a new tab; no viewer/media is fabricated.
- No customer account, email notifications, tax/shipping engine or analytics integration is included; none is presented as configured.

## Assets / launch content

See [asset provenance](docs/ASSETS.md). Generated concept art and SVG drawings clearly serve as placeholders for the owner's real product/model photographs. Do not treat sample fitments or prices as validated inventory. The owner must supply verified specifications, real stock, real business details, translations and applicable legal terms before public sales. Existing supplied screenshots are visual references only; their original Framer project and source assets were not available.

## Windows: official Node.js and a source-only package

Install the runtime separately from the official Node.js website. This project does not download or execute a Windows runtime installer. `npm.cmd run kurulum` uses the already installed Node.js/npm, asks for a local password with input hidden, writes a salted scrypt hash via stdin, runs `npm ci` with the locked integrity checks and builds the application. Existing `.env.local`, database and uploads are preserved. Start with `npm.cmd run local`; copy the printed URL into your browser. Keep the terminal open and stop with Ctrl+C.

The server listens on 127.0.0.1 only, reuses a running instance from the same folder and selects an unused port when necessary. Local auth uses HttpOnly/SameSite=Strict cookies on this explicit local HTTP connection. Hosted Supabase authentication is unchanged. After initial installation, local pages, admin, uploads, cart and demo requests work without Internet. Externally hosted media/services require Internet. Back up the folder after stopping the server, especially `.data`, `public/uploads` and `.env.local`.

Generate the source-only distribution with `python3 scripts/package-windows.py`. Its allowlist rejects Windows batch/PowerShell scripts and installer/binary payloads. It excludes private environment files, databases, uploads, caches, installed dependencies and Git history. The recipient installs platform-specific dependencies with official Node/npm. This build environment has no Windows Defender or native Windows installation; no antivirus certification or native Windows execution result is claimed.

For local workflow verification after a build, run `node scripts/test-local-offline.mjs`. It starts a loopback instance with ephemeral hashed test credentials, verifies reuse and runs six browser tests including external-request blocking and persisted edits. This verifies the Node/browser workflow on the current OS. The offline test is explicitly skipped in ordinary `npm run test:e2e` unless its dedicated credentials are provided. Run the distribution test with `python3 tests/windows-package.test.py`.

Analitik ve ısı haritası: tarayıcı panelindeki test kaydı, gerçek uygulamada izin temelli kayıt, Supabase göçü ve saklama ayarları için [Analitik kılavuzu](docs/ANALITIK.md).

Draft → publish → restore, unified product photography and ordered/device-filtered shopping analytics are implemented in both the browser workspace and the authenticated app. Apply migrations **004 and 005 after 001–003** for an existing Supabase installation. [Turkish publication and photography guide](docs/YAYIN-FOTOGRAF.md). Catalog writes now save private drafts; administrators explicitly publish. Operational stock and order status updates remain immediate, and restoring content never rewinds existing inventory. Browser publications stay in IndexedDB on that browser/origin and do not deploy a public website.

Model and product editors include a **Yayında** checkbox. Apply **007_model_visibility.sql after 001–006** to protect hidden models, their years, generations and compatibility through RLS. Unchecking saves a private draft; publishing removes the record from customer listings and direct URLs while retaining it and its related records in the dashboard. Products shared with other models remain available. Older browser drafts and saved versions without a model visibility flag retain their previous visible behavior.

The model editor now manages multiple generation/year ranges in one form, in both the browser workspace and authenticated application. Add a start year, end year and generation description per row. New/changed ranges generate production years; overlaps and removal of years used by existing fitments are rejected. Splitting a generation partitions existing fitments without extending their year coverage. Model/year IDs, sparse unchanged year sets, images and other owner data are retained. Server writes apply the model and generation changes together to the private draft; no additional database migration is required. Checks: `node --import tsx --test tests/model-generations.test.ts` and `node scripts/test-model-generations.mjs` (add `--app` for the production app).

Product creation/editing includes **Uyumlu modeller ve yıllar** in both panels. Rows select brand → model → optional generation → actual production-year bounds. Existing fitments are loaded automatically; rows can be added, edited or removed and are saved atomically with the product draft. Server validation checks row ownership, model/brand/generation consistency, valid production years and overlapping new ranges. Unchanged legacy fitments survive unrelated product edits; other products, inventory and media are retained. No migration is needed. Checks: `node --import tsx --test tests/product-compatibility.test.ts` and `node scripts/test-product-compatibility.mjs` (`--app` for the production app).

Motorcycle image containers now have a transparent background. Uploaded transparent PNG/WebP keeps its alpha channel; opaque backgrounds inside a source photo are retained. Product photography styling remains independently configurable.

## Custom Carbon, enquiries and production CRM

**Parçanı ürettir** provides one short guest/member enquiry form: customer-entered brand, model and year; image cards for Forged Carbon / Twill Carbon and plain radio options for lamination over an existing part / infusion of a new part from a mould; required part length/width in cm; one description; 3–8 photos; name and separate required phone and email fields. Carbon/production choices and contact fields are validated on the server. The original illustrative card images can be replaced in visual editing mode and survive design backups. Any motorcycle is accepted independently of the shop catalog. Existing motorcycle links prefill editable text fields and retain category/source metadata in the background. Motorcycle listings always offer both request types, including empty inventories; product details retain access without changing purchase controls. **Admin → Talepler & CRM** manages stages, audit history, private reference/receipt photos, follow-ups, original-part logistics, versioned manual quotations, recorded customer approvals, editable/versioned terms, customer grouping and demand analytics. Additional technical preferences can be clarified after enquiry. No automatic price/date promises, external messages or quote payments are simulated.

Apply **008_work_requests.sql after 001–007**, then **009_simple_work_requests.sql**, and configure the existing server-only `SUPABASE_SERVICE_ROLE_KEY` for live use. These create private RLS-protected tables, service-only write RPCs, the private `work-requests` bucket and catalog-independent customer motorcycle/dimension fields. Existing requests and history are preserved. The HTMLPreview panel offers synthetic `DEMO-` CRM records; customer submission remains disabled there. See the [Turkish request/CRM guide](docs/TALEPLER-CRM.md) for setup, owner workflows, evidence rules, privacy, backups and tests.

CRM and **Analytics → Talep & CRM analitiği** now share the same saved enquiries and report calculation, including customer-entered brands/models, carbon style, manufacturing method and source-page counts. Both refresh every 15 seconds and on focus; editing a CRM record or terms pauses automatic list refresh. Contact data/photos never enter visitor-event analytics, and clearing visitor events preserves requests. Database commits are atomic and idempotent; uncertain RPC responses recover the original receipt, while cleanup preserves linked photos. Live readiness verifies migration 009 columns and a private storage bucket. `tests/request-persistence.test.ts` checks recovery/storage safety with isolated SDK mocks; `scripts/test-requests.mjs --app` checks actual local submission → open CRM → business analytics and rollback on forced database failure. A configured Supabase installation must still be verified before accepting real customers.

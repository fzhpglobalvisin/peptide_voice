# Ridgeline Fit — Voice Research Assistant PWA

A fast, installable web app (PWA) that replicates the Ridgeline Fit storefront and adds a hands-free **Gemini Live** voice assistant, action cards, WhatsApp quote brochures and an analytics admin panel. The whole app is built around the store's **research-use-only** position.

> **Build status:** written and checked for syntax; the SQLite schema, seed data, search and every admin report query were run and verified. The npm registry was blocked where this was produced, so run `npm install && npm run typecheck && npm run build` on your machine before deploying and fix anything the type-checker flags.

---

## 1. Quick start

```bash
cp .env.example .env.local     # fill in the values (section 3)
npm install
npm run dev                    # http://localhost:3000
```

The SQLite database (`data/ridgeline.db`) is created and seeded automatically on the first request. `npm run db:reset` deletes it so it re-seeds.

Requirements: Node 20.9+ (better-sqlite3 compiles a native module; on Linux you may need `build-essential` and `python3`).

## 2. What's in it

| Area | Where |
|---|---|
| Researcher gate (21+ and lab-only, both required, logged with timestamp) | `components/VerificationGate.tsx`, `app/api/verify` |
| Storefront replica: ticker, header, NEW20 banner, Best Sellers, features, blends, FAQ, footer, Shop, Product, COAs, About, Contact, Cart | `app/(store)/*`, `components/site/*` |
| Floating voice assistant (bubbles, quick-prompt chips, mic meter, Close Session) | `components/voice/VoiceAssistant.tsx` |
| Gemini Live engine: 16 kHz mic capture, 24 kHz playback, barge-in, transcripts, auto-reconnect with session resumption | `components/voice/useGeminiLive.ts`, `audio.ts`, `public/worklets/pcm-capture.js` |
| Hands-free app control (15 tools: navigate, scroll, search, show product, cart, action cards, pre-fill, COA lookup, research context, lead, WhatsApp quote, compliance log) | `components/voice/useAppTools.ts`, `lib/live-config.ts` |
| Action cards: Compare Specs, Bulk/Lab Quote, Quick Checkout, View COA (pre-filled by voice) | `components/ActionCards.tsx` |
| WhatsApp quote brochure (image page + wa.me link, optional Cloud API send after opt-in) | `app/api/quotes`, `app/(store)/quote/[id]`, `lib/whatsapp.ts` |
| Raw SQLite schema + FTS5 catalog search, no ORM | `lib/schema.ts`, `lib/db.ts`, `lib/catalog.ts`, `lib/store.ts` |
| Admin (username + password login): analytics, product CRUD/retire, sessions with transcript + AI summary, leads & orders, CSV export | `app/admin/*`, `lib/analytics.ts` |
| PWA: manifest, icons, service worker, offline page | `app/manifest.ts`, `public/sw.js`, `public/icons` |

### How the voice connection works

```
Browser ──POST /api/sessions──▶ server (creates chat session, rate-limited per IP)
Browser ──POST /api/live-token─▶ server ──▶ Gemini: single-use ephemeral token
                                        (model, system prompt and tools are LOCKED into the token)
Browser ◀══ WebSocket audio (direct to Gemini, lowest latency) ══▶ Gemini Live
Browser: tool calls run in the page (navigate, cart, cards…) → results sent back to Gemini
Close Session ──▶ /api/sessions/close: transcript saved, summary generated in the background
```

Your real `GEMINI_API_KEY` never reaches the browser, and a visitor can't change the prompt, tools or model. Tokens expire after 30 minutes; the hook reconnects transparently using the session-resumption handle, so a conversation stays open until the user presses **Close Session**.

## 3. Configuration

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY` | From Google AI Studio (uses your prepaid credits). |
| `GEMINI_LIVE_MODEL` | Default `gemini-3.1-flash-live-preview`. Live model names change often — check Google's model list and set the current one. |
| `GEMINI_TEXT_MODEL` | For session summaries. Default `gemini-2.5-flash`. |
| `GEMINI_VOICE` | Prebuilt voice, e.g. `Puck`, `Kore`, `Aoede`. |
| `LIVE_SESSIONS_PER_IP_PER_HOUR` | Protects your credits. Default 12. |
| `NEXT_PUBLIC_SITE_URL` | Public URL; used in WhatsApp brochure links. |
| `NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER` | Store's WhatsApp, digits only with country code. |
| `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME` | Optional. Needs a Meta-approved template with body variables `{{1}}` name and `{{2}}` quote URL. Without these, customers send the quote themselves via a wa.me button. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` | Create the first admin account on first run. After that, manage login details in **/admin/account**. |
| `AUTH_SECRET` | Long random string that signs the login cookie. Changing it signs everyone out. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Sends "forgot username or password" emails. Gmail works with an App Password. Unset in development = email printed in the terminal. |

### Admin login recovery

- **Forgot username or password:** on the login page, enter the admin's recovery email. It receives the username and a one-time reset link (valid 30 minutes).
- **No email access:** on the server, run `npm run reset-admin -- <username> <new-password> [email]`. It also creates the admin if it doesn't exist and signs out all existing logins.
- **Change details:** **/admin/account** changes username, recovery email and password. Changing the password signs out other devices.

## 4. Content to finish

1. **Missing products.** The screenshots skipped part of the catalog (between *BPC10MG+TB10MG* and *SNAP-8*). Add them in **/admin/products**.
2. **Product options.** Products with a price range need their sizes: edit each product and add lines like `5mg | 40.00`. Until then, the starting price is used and customers can request a quote.
3. **Photos.** Paste product image URLs in the admin, and add the banner photos listed in `public/images/README.txt`.
4. **COA PDFs.** The `coas.file_url` column is ready; add the PDF links (a COA editor can be added to the admin, or update via SQL).
5. **Privacy and Refund pages** are templates — replace with the client's real text.

## 5. Deploy

SQLite needs a **persistent disk**, so use a VPS or a platform with volumes (not serverless).

**VPS (Ubuntu) with PM2 + Nginx**

```bash
sudo apt install -y build-essential python3 nginx
git clone <repo> ridgeline && cd ridgeline
cp .env.example .env.production   # fill in
npm ci && npm run build
npx pm2 start "npm start" --name ridgeline && npx pm2 save
```

Nginx: proxy `https://app.yourdomain.com` → `http://127.0.0.1:3000` with HTTPS (Certbot). **HTTPS is required** — browsers only allow microphone access and service workers on secure origins.

**Railway / Fly.io / Render:** mount a volume at `/data` and set `DATABASE_PATH=/data/ridgeline.db`.

Back up `ridgeline.db` daily (e.g. `sqlite3 ridgeline.db ".backup /backups/rf-$(date +%F).db"`).

## 6. Installing as an app (instead of app stores)

- **Android (Chrome):** visit the site → menu → *Install app*. It gets a home-screen icon, full screen and mic access.
- **iPhone (Safari):** Share → *Add to Home Screen*.

The Google Play and Apple App Store builds from the original blueprint were dropped on purpose: both stores prohibit apps that sell unapproved drugs or research peptides, so those builds would very likely be rejected and could put the developer account at risk.

## 7. Compliance design (what changed from the blueprint and why)

| Blueprint item | What was built instead | Why |
|---|---|---|
| AI asks "who are we shopping for", age, gender | AI asks **research context**: institution type, research area in lab terms, quantity scale, COA needs | Asking about the person and targeting by demographics turns a research-only store into consumer marketing of unapproved drugs, and contradicts the researcher gate. |
| `demographic_insights` table | `research_context` table; no age, gender or health data is collected | Same; also less personal data to protect. |
| Sales pitches personalised to the person | Spec-only comparisons (options, purity, price, COA) | Effect-based pitching is a health claim. |
| Google Search grounding for "market trends" | Not enabled; catalog-only answers | Web results about these compounds are mostly human-use content the assistant must not repeat. |
| Native Android/iOS store builds | Installable PWA | Store policies (see section 6). |

Additional safeguards:

- The system prompt forbids dosing, administration, human/animal use and health claims in every language. The assistant declines, points to a licensed professional, stops helping with the purchase if personal use is clear, and logs a **compliance redirect** (visible per session and in the dashboard).
- Signs of a possible minor stop the sales conversation and are logged.
- The gate must be confirmed before any page, voice session or API that stores data; each confirmation is recorded.
- Checkout requires institution name plus two attestations, re-prices everything server-side, and creates an **order request** that staff review before invoicing (no card data is handled).
- WhatsApp numbers are stored only with explicit opt-in.
- Research-use disclaimers on every product page, quote brochure, action card and footer.

**Have the client's lawyer review before launch.** These measures reduce risk but don't make the business compliant on their own; the FDA and FTC look at the whole business, including labels, marketing, social media and who actually buys.

## 8. Testing the voice assistant

1. Confirm the gate, tap the mic button, allow the microphone.
2. Say: "Show me your best sellers" → it scrolls/navigates.
3. "Compare BPC 157 and TB500" → Compare Specs card opens.
4. Talk while it's answering → it stops mid-sentence (barge-in).
5. "Add two BPC 157 to my cart", then "send me a WhatsApp quote" → it asks only for your name and WhatsApp number, then shows **Send on WhatsApp**.
6. Ask "what dose should I take?" → it declines; check **/admin** → compliance redirects.
7. Switch to Spanish, Arabic or Urdu mid-conversation → it answers in that language.
8. Press the red **End** button (twice) → the transcript and summary appear under **/admin → Recent sessions** within a few seconds.

### WhatsApp-only ordering

Customers give only **name + WhatsApp number**. Quotes and orders open WhatsApp with the full order text and a brochure link, addressed to `NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER`. If the WhatsApp Cloud API is configured, the brochure link is also sent to the customer's own number automatically. No email or PDF is involved.

### Full screen control by voice

The assistant can operate anything on screen. It reads the visible buttons, links, fields, dropdowns, checkboxes and popups (`read_screen`) and acts on them (`components/voice/dom-control.ts`), so new components work automatically. Try:

- "Close this" / "close the popup" → closes any action card, popup or mobile menu
- "Search for BPC" → types in the search box and runs it
- "Choose the 10 milligram option" → picks from the dropdown
- "Press add to cart" / "click checkout" / "open the menu" / "scroll down" / "go back"
- "What does this page say?"
- "Hide the chat" (keeps listening) · "show the chat" · "mute" · "clear the chat"
- Only the user can end a session: the red **End** button next to the floating icon (tap twice), or **Close Session** in the chat box. The assistant can't close it.

Protected on purpose: the 21+/researcher confirmations, research-use attestation and WhatsApp consent checkboxes are marked `data-ai="off"`, so the user must tick them personally. The assistant also won't type passwords. Add `data-ai="off"` to any element the assistant must not change, or `data-ai-skip` to hide it completely.

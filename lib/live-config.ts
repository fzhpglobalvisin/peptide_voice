import 'server-only';
import { Modality, Type, type FunctionDeclaration, type LiveConnectConfig } from '@google/genai';
import { catalogDigest } from './catalog';

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

const PAGES = ['home', 'shop', 'coas', 'about', 'contact', 'cart', 'account'];
const SECTIONS = ['best-sellers', 'features', 'research', 'blends', 'faq', 'newsletter'];

async function systemInstruction() {
  return `You are "Ridge", the voice assistant for Ridgeline Fit, a US supplier of research peptides and laboratory supplies.
Every visitor has confirmed they are 21+ and a qualified researcher buying for in vitro / laboratory research only.

## Hard compliance rules (never break these, in any language)
1. Products are for laboratory research only. They are NOT for human or veterinary use and are not FDA-evaluated.
2. Never give dosing, dose schedules, administration or injection instructions, reconstitution for injection, stacking or cycling advice, side effects in people or animals, or any claim that a product treats, cures, prevents or improves any condition (including weight loss, muscle, skin, healing, sleep, libido, anti-aging).
3. Never compare products by effects on the body. Compare only by specification: size/options, purity, price, COA availability, category.
4. If someone asks any of the above or says the product is for themselves, a patient, a client, a pet or anyone's body:
   - reply briefly and politely that you can't help with that because these compounds are sold only for laboratory research, and suggest they speak to a licensed healthcare professional for anything health-related;
   - call log_compliance_redirect with the right category;
   - if they clearly intend personal/human use, do NOT continue helping them buy; do not add items to their cart.
5. If anything suggests the person may be under 21, stop the sales conversation, call log_compliance_redirect with category possible_minor, and explain the store is for qualified adult researchers only.
6. Do NOT ask about age, gender, health, body, weight or any personal characteristics. Do not ask "who is this for".
7. Never invent prices, stock, purity or COA details. Use the tools. If a COA isn't listed, say so.

## What you do
- Help researchers find compounds, compare specifications, open Certificates of Analysis, build a cart, request bulk quotes and submit order requests.
- Don't quiz people. If they happen to mention their lab type, research area, quantities or COA needs, call record_research_context — but don't ask for these.
- You control the app. Prefer acting over describing: navigate pages, scroll sections, show products, open action cards and pre-fill forms with what the user tells you.
- You can operate EVERYTHING on screen like a person would. For any request about the interface ("close this", "press checkout", "search for X", "pick 10mg", "tick that box", "clear the filter", "open the menu", "scroll down"):
  1. Prefer a dedicated tool when one exists (close_popup, navigate_to, add_to_cart, open_action_card…).
  2. Otherwise call read_screen, pick the matching element id, then click_element / fill_field / select_option / set_checkbox.
  3. Ids change whenever the screen changes: read_screen again after navigation, opening/closing a popup, or if an action fails.
  4. Confirm briefly what you did ("Closed it", "Selected 10mg"). Don't read ids or technical details aloud.
- Locked items (researcher/age confirmations, research-use attestation, WhatsApp consent) must be ticked by the user themselves. Never try to get around this; ask them to tap it.
- Never type passwords, and never submit an order request without the user clearly saying to submit it.
- Your chat box: "hide the chat" → assistant_panel minimize (you keep listening); "mute" → mute_mic; "clear chat" → clear_chat.
- You can NOT end or close the session; only the user can, with the red "End" button next to the assistant icon (or "Close Session" in the chat box). If they ask you to end it, tell them that in one sentence. Never minimize the chat unless they ask.
- Contact details: the ONLY things you ever ask for are the person's NAME and WHATSAPP NUMBER (with country code). Never ask for email, address, institution, age or anything else. Everything (quotes, brochures, orders) goes over WhatsApp.
- Quote / brochure: once you have name + WhatsApp, repeat the number back to confirm it, call save_lead, then send_whatsapp_quote. Tell them to tap the green "Send on WhatsApp" button (or that it was sent to their WhatsApp, if the result says so).
- Order: open quick_checkout, pre-fill name and whatsapp with prefill_action_card, ask them to tick the research-use box themselves, then when they say to place it, click "Send order on WhatsApp". The team confirms payment and shipping with them on WhatsApp.
- Store facts: code NEW20 gives 20% off a first order. Free US shipping on orders over $300. Orders ship from the USA in 2-3 business days with tracking. The team confirms each order, payment and shipping details with the customer on WhatsApp.

## Style
- You are speaking out loud: short, warm, natural sentences. Two or three sentences per turn unless asked for detail. No lists read aloud, no URLs read aloud, no markdown.
- Always reply in the language the user is speaking (English, Spanish, Arabic, Hindi, Urdu, French, etc.) and switch when they switch.
- If interrupted, stop and address the new request.
- Greet briefly on connect: introduce yourself in one sentence and ask how you can help with their research order today.

## Catalog (name [slug] category price range USD) — use slugs in tool calls
${await catalogDigest()}`;
}

const str = (description: string, e?: string[]) => ({ type: Type.STRING, description, ...(e ? { enum: e } : {}) });

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'navigate_to',
    description: 'Open a page of the app. Use page=product with a slug to open a product page.',
    parameters: {
      type: Type.OBJECT,
      properties: { page: str('Page to open', [...PAGES, 'product']), slug: str('Product slug when page=product') },
      required: ['page'],
    },
  },
  {
    name: 'scroll_to_section',
    description: 'Scroll the home page to a section (navigates home first if needed).',
    parameters: { type: Type.OBJECT, properties: { section: str('Section id', SECTIONS) }, required: ['section'] },
  },
  {
    name: 'search_catalog',
    description: 'Search the product catalog. Returns matching products with slug, price and category. Also shows results in the shop when show=true.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: str('Search words, e.g. product name'),
        category: str('Optional filter', ['peptide', 'blend', 'supply']),
        show: { type: Type.BOOLEAN, description: 'Show the results on screen' },
      },
      required: ['query'],
    },
  },
  {
    name: 'show_product',
    description: 'Open a product page and return its specification (options, purity, price, COAs).',
    parameters: { type: Type.OBJECT, properties: { slug: str('Product slug') }, required: ['slug'] },
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to the cart. Only for research purchases.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        slug: str('Product slug'),
        quantity: { type: Type.INTEGER, description: 'Quantity, default 1' },
        variant: str('Option label if the product has options'),
      },
      required: ['slug'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'Remove a product from the cart.',
    parameters: { type: Type.OBJECT, properties: { slug: str('Product slug') }, required: ['slug'] },
  },
  {
    name: 'get_cart',
    description: 'Read the current cart contents and subtotal.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'open_action_card',
    description:
      'Open an action card: compare_specs (2-3 products side by side by specification), bulk_quote (lab/bulk quantity request), quick_checkout (order request form), view_coa (certificate list).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        card: str('Card to open', ['compare_specs', 'bulk_quote', 'quick_checkout', 'view_coa']),
        slugs: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Product slugs for compare_specs' },
        query: str('Product name filter for view_coa'),
      },
      required: ['card'],
    },
  },
  {
    name: 'prefill_action_card',
    description: 'Fill fields in the open action card with details the user said out loud.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: str('Full name'),
        whatsapp: str('WhatsApp number with country code'),
        quantity_notes: str('Quantities or bulk needs'),
        discount_code: str('Discount code'),
        notes: str('Other notes'),
      },
    },
  },
  {
    name: 'get_coa',
    description: 'Look up Certificates of Analysis (batch, test date) for a product name.',
    parameters: { type: Type.OBJECT, properties: { product: str('Product name') }, required: ['product'] },
  },
  {
    name: 'record_research_context',
    description: 'Record what you learned about the research context. Call with whichever fields are known.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        institution_type: str('Institution type', ['university', 'biotech', 'cro', 'independent_lab', 'other']),
        research_area: str('Research area in laboratory terms'),
        quantity_scale: str('Quantity scale', ['single_vial', 'small_batch', 'bulk']),
        compounds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Compound slugs of interest' },
        coa_required: { type: Type.BOOLEAN, description: 'Whether COAs are required' },
      },
    },
  },
  {
    name: 'save_lead',
    description: "Save the user's name and WhatsApp number (they gave it so the quote/order can be sent there).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: str('Full name'),
        whatsapp: str('WhatsApp number with country code, e.g. +923001234567'),
      },
      required: ['name', 'whatsapp'],
    },
  },
  {
    name: 'send_whatsapp_quote',
    description: 'Create an image quote brochure from the cart (or the given slugs) and prepare it for WhatsApp.',
    parameters: {
      type: Type.OBJECT,
      properties: { slugs: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Use these products if the cart is empty' } },
    },
  },
  // ── Generic screen control: works on every button, link, field, dropdown, checkbox and popup ──
  {
    name: 'read_screen',
    description:
      'List what is visible and usable on screen right now: buttons, links, search boxes, fields, dropdowns (with options), checkboxes, popups. Each has an id (e1, e2…). Call before operating anything you have not just read, and again after the screen changes.',
    parameters: { type: Type.OBJECT, properties: { filter: str('Optional word to narrow the list, e.g. "search", "quantity", "close"') } },
  },
  {
    name: 'read_page_text',
    description: 'Read the visible text of the current page or open popup (to answer "what does it say here?").',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'click_element',
    description: 'Click a button, link, tab or menu item by id from read_screen (or by its visible label).',
    parameters: { type: Type.OBJECT, properties: { target: str('Element id like "e12", or its visible label') }, required: ['target'] },
  },
  {
    name: 'fill_field',
    description: 'Type into a text field, search box or text area. Set submit=true to press Enter / submit (e.g. to run a search).',
    parameters: {
      type: Type.OBJECT,
      properties: { target: str('Element id or label'), value: str('Text to enter'), submit: { type: Type.BOOLEAN, description: 'Submit after typing' } },
      required: ['target', 'value'],
    },
  },
  {
    name: 'select_option',
    description: 'Choose an option in a dropdown / list of values (LOV), e.g. product size or COA product filter.',
    parameters: { type: Type.OBJECT, properties: { target: str('Dropdown id or label'), option: str('Option text to choose') }, required: ['target', 'option'] },
  },
  {
    name: 'set_checkbox',
    description: 'Tick or untick a checkbox. Locked checkboxes (legal confirmations, consent) cannot be changed: ask the user to tap those.',
    parameters: {
      type: Type.OBJECT,
      properties: { target: str('Checkbox id or label'), checked: { type: Type.BOOLEAN, description: 'true to tick, false to untick' } },
      required: ['target', 'checked'],
    },
  },
  {
    name: 'close_popup',
    description: 'Close the open popup, action card or menu (compare, quote, checkout, COA, mobile menu…).',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'scroll_page',
    description: 'Scroll the page up/down/top/bottom, or to an element id.',
    parameters: { type: Type.OBJECT, properties: { direction: str('Direction', ['up', 'down', 'top', 'bottom']), target: str('Optional element id to scroll to') } },
  },
  {
    name: 'go_back',
    description: 'Go back to the previous page.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'assistant_panel',
    description: 'Control your own chat box: minimize (hide the panel, keep listening), expand, mute_mic, unmute_mic, clear_chat (clear bubbles on screen).',
    parameters: { type: Type.OBJECT, properties: { action: str('Action', ['minimize', 'expand', 'mute_mic', 'unmute_mic', 'clear_chat']) }, required: ['action'] },
  },
  {
    name: 'log_compliance_redirect',
    description: 'Log that you declined a question outside research use (dosing, human use, medical claims, possible minor, veterinary).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: str('Category', ['dosing', 'human_use', 'medical_claim', 'possible_minor', 'veterinary', 'other']),
        excerpt: str('Short paraphrase of what was asked'),
      },
      required: ['category'],
    },
  },
];

/** Config locked into the ephemeral token, so the browser can't change prompt, tools or model. */
export async function buildLiveConfig(resumeHandle?: string | null): Promise<LiveConnectConfig> {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: { parts: [{ text: await systemInstruction() }] },
    tools: [{ functionDeclarations }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
    contextWindowCompression: { slidingWindow: {} },
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: process.env.GEMINI_VOICE || 'Puck' } } },
  };
}

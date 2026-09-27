'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';
import { useApp } from '../AppProvider';
import { api, toCartItem } from '@/lib/client';
import { money, priceLabel, type ActionCardKind, type CartItem } from '@/lib/types';
import { clickElement, closeTopPopup, fillField, readPageText, readScreen, scrollPage, selectOption, setCheckbox } from './dom-control';

type Args = Record<string, unknown>;
export type ToolResult = Record<string, unknown>;
export type AddAction = (text: string, action?: { label: string; href: string }) => void;

/** Callbacks into the assistant itself (its chat panel and session). */
export interface AssistantControls {
  panel: (action: 'minimize' | 'expand' | 'mute_mic' | 'unmute_mic' | 'clear_chat') => void;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const CARDS: ActionCardKind[] = ['compare_specs', 'bulk_quote', 'quick_checkout', 'view_coa'];

/**
 * Executes the assistant's function calls against the live app (hands-free control).
 * Returns a stable function that always sees the latest app state.
 */
export function useAppTools(addAction: AddAction, controls: { current: AssistantControls | null }) {
  const app = useApp();
  const router = useRouter();
  const path = usePathname();
  const latest = useRef({ app, path, addAction });
  latest.current = { app, path, addAction };

  return useCallback(async (name: string, args: Args): Promise<ToolResult> => {
    const { app, path, addAction } = latest.current;
    const sid = app.sessionId;

    switch (name) {
      case 'navigate_to': {
        const page = str(args.page);
        const routes: Record<string, string> = { home: '/', shop: '/shop', coas: '/coas', about: '/about', contact: '/contact', cart: '/cart', account: '/my-account' };
        if (page === 'product' && args.slug) {
          router.push(`/product/${encodeURIComponent(str(args.slug))}`);
          return { ok: true, opened: `product ${args.slug}` };
        }
        if (!routes[page]) return { ok: false, error: 'unknown page' };
        router.push(routes[page]);
        return { ok: true, opened: page };
      }

      case 'scroll_to_section': {
        const id = str(args.section);
        if (path !== '/') router.push(`/#${id}`);
        else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return { ok: true };
      }

      case 'search_catalog': {
        const q = str(args.query);
        const category = str(args.category) || undefined;
        const products = await api.search(q, { category, ai: true, sessionId: sid });
        if (args.show) router.push(`/shop?${new URLSearchParams({ q, ...(category ? { category } : {}) })}`);
        return {
          count: products.length,
          products: products.slice(0, 8).map((p) => ({ slug: p.slug, name: p.name, price: priceLabel(p), category: p.category, options: p.variants.map((v) => v.label) })),
        };
      }

      case 'show_product': {
        const slug = str(args.slug);
        try {
          const { product: p, coas } = await api.product(slug);
          router.push(`/product/${p.slug}`);
          app.track([p.slug], 'view');
          return {
            name: p.name,
            price: priceLabel(p),
            options: p.variants.map((v) => `${v.label} ${money(v.price)}`),
            purity: p.category === 'supply' ? null : p.purity,
            category: p.category,
            coas: coas.map((c) => `${c.label}, batch ${c.batch}, tested ${c.test_date}`),
            note: 'Research use only. Give specifications only.',
          };
        } catch {
          return { error: `No product with slug ${slug}. Use search_catalog.` };
        }
      }

      case 'add_to_cart': {
        try {
          const { product } = await api.product(str(args.slug));
          const qty = Math.max(1, Math.min(99, Math.floor(Number(args.quantity) || 1)));
          const item = toCartItem(product, str(args.variant) || null, qty);
          app.addToCart(item);
          return { ok: true, added: `${qty} × ${product.name}${item.variant ? ` (${item.variant})` : ''}`, unit_price: money(item.price) };
        } catch {
          return { ok: false, error: 'Product not found' };
        }
      }

      case 'remove_from_cart':
        app.removeFromCart(str(args.slug));
        return { ok: true };

      case 'get_cart':
        return {
          items: app.cart.map((i) => ({ slug: i.slug, name: i.name, variant: i.variant, qty: i.qty, line: money(i.price * i.qty) })),
          subtotal: money(app.subtotal),
          free_shipping: app.subtotal >= 300,
        };

      case 'open_action_card': {
        const card = str(args.card) as ActionCardKind;
        if (!CARDS.includes(card)) return { ok: false, error: 'unknown card' };
        const slugs = Array.isArray(args.slugs) ? args.slugs.map(String).slice(0, 3) : undefined;
        if (card === 'compare_specs' && slugs?.length) {
          fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slugs, type: 'ai_recommend', sessionId: sid }) }).catch(() => {});
        }
        app.openCard(card, { slugs, query: str(args.query) || undefined });
        return { ok: true, opened: card };
      }

      case 'prefill_action_card': {
        const fields: Record<string, string> = {};
        for (const [k, v] of Object.entries(args)) if (typeof v === 'string' && v.trim()) fields[k] = v.trim();
        app.prefillCard(fields);
        return { ok: true, filled: Object.keys(fields) };
      }

      case 'get_coa': {
        const coas = await api.coas(str(args.product));
        return coas.length
          ? { coas: coas.slice(0, 8).map((c) => ({ label: c.label, batch: c.batch, tested: c.test_date, document: c.file_url ? 'available' : 'on request' })) }
          : { coas: [], note: 'No COA listed for this product.' };
      }

      case 'record_research_context':
        if (sid) await api.research({ sessionId: sid, ...args }).catch(() => {});
        return { ok: true };

      case 'save_lead': {
        try {
          const { leadId } = await api.lead({
            name: str(args.name),
            whatsapp: str(args.whatsapp),
            // Giving the number so the quote/order can be sent there is the consent.
            consent_whatsapp: true,
            source: 'voice',
            sessionId: sid,
          });
          app.setLeadId(leadId);
          // Keep the name/number handy for any open order form.
          app.prefillCard({ name: str(args.name), whatsapp: str(args.whatsapp) });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      }

      case 'send_whatsapp_quote': {
        let items: CartItem[] = app.cart;
        if (!items.length && Array.isArray(args.slugs) && args.slugs.length) {
          const products = await api.bySlugs(args.slugs.map(String));
          items = products.map((p) => toCartItem(p));
        }
        if (!items.length) return { ok: false, error: 'Cart is empty. Add products or pass slugs.' };
        try {
          const q = await api.quote(items, sid, app.leadId);
          addAction(
            q.sentViaCloud ? 'Your quote brochure was sent to your WhatsApp. You can also open it here:' : 'Your quote brochure is ready. Tap to send it to us on WhatsApp:',
            q.sentViaCloud ? { label: 'Open brochure', href: q.brochureUrl } : { label: 'Send on WhatsApp', href: q.waUrl },
          );
          return {
            ok: true,
            subtotal: money(q.subtotal),
            delivered: q.sentViaCloud ? 'sent to the customer WhatsApp' : 'a Send on WhatsApp button is shown in the chat; ask the user to tap it',
          };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      }

      // ── Generic screen control ──
      case 'read_screen':
        return readScreen(str(args.filter) || undefined);

      case 'read_page_text':
        return readPageText();

      case 'click_element':
        return clickElement(str(args.target));

      case 'fill_field':
        return fillField(str(args.target), str(args.value), args.submit === true);

      case 'select_option':
        return selectOption(str(args.target), str(args.option));

      case 'set_checkbox':
        return setCheckbox(str(args.target), args.checked !== false);

      case 'close_popup': {
        // Action cards live in app state: close them directly; anything else via the DOM.
        if (app.card) {
          const closed = app.card.kind;
          app.closeCard();
          return { ok: true, closed };
        }
        return closeTopPopup();
      }

      case 'scroll_page':
        return scrollPage(str(args.direction) || 'down', str(args.target) || undefined);

      case 'go_back':
        router.back();
        return { ok: true };

      case 'assistant_panel': {
        const action = str(args.action) as Parameters<AssistantControls['panel']>[0];
        if (!['minimize', 'expand', 'mute_mic', 'unmute_mic', 'clear_chat'].includes(action)) return { ok: false, error: 'unknown action' };
        controls.current?.panel(action);
        return { ok: true, done: action, note: action === 'mute_mic' ? 'Microphone muted: the user must unmute by tapping the mic or typing.' : undefined };
      }

      case 'log_compliance_redirect':
        await api.compliance({ sessionId: sid, category: str(args.category), excerpt: str(args.excerpt) }).catch(() => {});
        return { ok: true, reminder: 'Do not provide the requested information. Offer specification, COA or ordering help only.' };

      default:
        return { error: `Unknown tool ${name}` };
    }
  }, [router]);
}

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActionCardKind, ActionCardState, CartItem } from '@/lib/types';

interface AppCtx {
  verified: boolean;
  setVerified: (v: boolean) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (slug: string) => void;
  setQty: (slug: string, variant: string | null, qty: number) => void;
  clearCart: () => void;
  subtotal: number;
  card: ActionCardState | null;
  openCard: (kind: ActionCardKind, opts?: { slugs?: string[]; query?: string; fields?: Record<string, string> }) => void;
  prefillCard: (fields: Record<string, string>) => void;
  closeCard: () => void;
  /** Chat session id (null until the user starts the assistant) — used for attribution. */
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  /** Last lead id saved in this browser session (links quotes/orders to the lead). */
  leadId: number | null;
  setLeadId: (id: number | null) => void;
  track: (slugs: string[], type: 'view' | 'cart_add') => void;
}

const Ctx = createContext<AppCtx | null>(null);
const CART_KEY = 'rf_cart_v1';

export function AppProvider({ children, initialVerified }: { children: ReactNode; initialVerified: boolean }) {
  const [verified, setVerified] = useState(initialVerified);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [card, setCard] = useState<ActionCardState | null>(null);
  // Name + WhatsApp given once (by voice or form) are reused in every quote/order form.
  const contact = useRef<Record<string, string>>({});
  const [sessionId, setSessionIdState] = useState<string | null>(null);
  const [leadId, setLeadIdState] = useState<number | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw));
      const sid = sessionStorage.getItem('rf_session');
      if (sid) setSessionIdState(sid);
      const lid = sessionStorage.getItem('rf_lead');
      if (lid) setLeadIdState(Number(lid));
    } catch {}
    loaded.current = true;
    // Signed-in customers: pre-fill name + WhatsApp in quote/order forms.
    fetch('/api/me')
      .then((r) => r.json())
      .then((me: { signedIn?: boolean; name?: string; whatsapp?: string }) => {
        if (!me.signedIn) return;
        if (me.name && !contact.current.name) contact.current.name = me.name;
        if (me.whatsapp && !contact.current.whatsapp) contact.current.whatsapp = me.whatsapp;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const setSessionId = useCallback((id: string | null) => {
    setSessionIdState(id);
    try {
      id ? sessionStorage.setItem('rf_session', id) : sessionStorage.removeItem('rf_session');
    } catch {}
  }, []);

  const setLeadId = useCallback((id: number | null) => {
    setLeadIdState(id);
    try {
      id ? sessionStorage.setItem('rf_lead', String(id)) : sessionStorage.removeItem('rf_lead');
    } catch {}
  }, []);

  const track = useCallback(
    (slugs: string[], type: 'view' | 'cart_add') => {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs, type, sessionId }),
        keepalive: true,
      }).catch(() => {});
    },
    [sessionId],
  );

  const addToCart = useCallback(
    (item: CartItem) => {
      setCart((c) => {
        const i = c.findIndex((x) => x.slug === item.slug && x.variant === item.variant);
        if (i >= 0) {
          const next = [...c];
          next[i] = { ...next[i], qty: next[i].qty + item.qty };
          return next;
        }
        return [...c, item];
      });
      track([item.slug], 'cart_add');
    },
    [track],
  );

  const value = useMemo<AppCtx>(
    () => ({
      verified,
      setVerified,
      cart,
      addToCart,
      removeFromCart: (slug) => setCart((c) => c.filter((x) => x.slug !== slug)),
      setQty: (slug, variant, qty) =>
        setCart((c) =>
          qty <= 0 ? c.filter((x) => !(x.slug === slug && x.variant === variant)) : c.map((x) => (x.slug === slug && x.variant === variant ? { ...x, qty } : x)),
        ),
      clearCart: () => setCart([]),
      subtotal: Math.round(cart.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100,
      card,
      openCard: (kind, opts) => setCard({ kind, slugs: opts?.slugs, query: opts?.query, fields: { ...contact.current, ...(opts?.fields ?? {}) } }),
      prefillCard: (fields) => {
        if (fields.name) contact.current.name = fields.name;
        if (fields.whatsapp) contact.current.whatsapp = fields.whatsapp;
        setCard((c) => (c ? { ...c, fields: { ...c.fields, ...fields } } : c));
      },
      closeCard: () => setCard(null),
      sessionId,
      setSessionId,
      leadId,
      setLeadId,
      track,
    }),
    [verified, cart, addToCart, card, sessionId, setSessionId, leadId, setLeadId, track],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

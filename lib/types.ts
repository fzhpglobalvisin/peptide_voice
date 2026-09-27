// Types shared by server and client code.

export type Category = 'peptide' | 'blend' | 'supply';

export interface Variant {
  label: string;
  price: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  category: Category;
  price_min: number;
  price_max: number;
  variants: Variant[];
  purity: string;
  description: string;
  image_url: string | null;
  is_best_seller: boolean;
  status: 'active' | 'retired';
}

export interface Coa {
  id: number;
  product_id: number | null;
  product_slug: string | null;
  label: string;
  batch: string;
  test_date: string;
  file_size_mb: number | null;
  file_url: string | null;
  status: 'current' | 'archived';
}

export interface CartItem {
  slug: string;
  name: string;
  variant: string | null;
  price: number;
  qty: number;
  image_url: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  at: number;
  /** open = still streaming transcription */
  open?: boolean;
  /** optional action button rendered under an AI bubble */
  action?: { label: string; href: string };
}

export type ActionCardKind = 'compare_specs' | 'bulk_quote' | 'quick_checkout' | 'view_coa';

export interface ActionCardState {
  kind: ActionCardKind;
  slugs?: string[];
  query?: string;
  fields: Record<string, string>;
}

export const DISCOUNT_CODES: Record<string, number> = { NEW20: 0.2 };
export const FREE_SHIPPING_THRESHOLD = 300;

export function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function priceLabel(p: Pick<Product, 'price_min' | 'price_max'>) {
  return p.price_min === p.price_max ? money(p.price_min) : `${money(p.price_min)} – ${money(p.price_max)}`;
}

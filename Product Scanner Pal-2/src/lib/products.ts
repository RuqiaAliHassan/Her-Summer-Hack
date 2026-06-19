import rawProducts from "@/data/products.json";

export type Product = {
  product_code: string;
  product_id: string;
  name: string;
  brand: string;
  category: string;
  color: string;
  size: string;
  price_chf: number;
  discount_pct: number;
  weight_g: number | null;
  waterproof_rating_mm: number | null;
  temp_rating_c: number | null;
  material: string;
  tags: string[];
  zone: string;
  zone_name: string;
  aisle: string;
  stock_total: number;
  stock_front: number;
  description: string;
};

export const PRODUCTS: Product[] = rawProducts as Product[];

// Group variants by product_id
export type ProductGroup = {
  product_id: string;
  base: Product;
  variants: Product[];
  sizes: { size: string; stock: number; code: string }[];
};

export function groupVariants(items: Product[]): Map<string, ProductGroup> {
  const map = new Map<string, ProductGroup>();
  for (const p of items) {
    let g = map.get(p.product_id);
    if (!g) {
      g = { product_id: p.product_id, base: p, variants: [], sizes: [] };
      map.set(p.product_id, g);
    }
    g.variants.push(p);
    g.sizes.push({ size: p.size, stock: p.stock_total, code: p.product_code });
  }
  return map;
}

// ─── Filters ────────────────────────────────────────────────────────────────
export type Filter = {
  id: string;
  label: string;
  icon?: string;
  test: (p: Product) => boolean;
};

export const FILTERS: Filter[] = [
  {
    id: "waterproof",
    label: "Waterproof",
    icon: "💧",
    test: (p) => p.tags.includes("waterproof") || (p.waterproof_rating_mm ?? 0) >= 10000,
  },
  {
    id: "ultralight",
    label: "Under 400g",
    icon: "🪶",
    test: (p) => p.weight_g !== null && p.weight_g < 400,
  },
  {
    id: "size-42",
    label: "Size 42",
    icon: "👟",
    test: (p) => String(p.size) === "42",
  },
  {
    id: "cold-rated",
    label: "Rated −10°C",
    icon: "❄️",
    test: (p) => p.temp_rating_c !== null && p.temp_rating_c <= -10,
  },
  {
    id: "boots",
    label: "Boots",
    icon: "🥾",
    test: (p) => p.category === "boots" || p.category === "approach-shoes",
  },
  {
    id: "hardshell",
    label: "Hardshells",
    icon: "🧥",
    test: (p) => p.category === "hardshell" || p.category === "rain-jacket",
  },
  {
    id: "on-sale",
    label: "On sale",
    icon: "🏷️",
    test: (p) => (p.discount_pct ?? 0) > 0,
  },
];

// ─── Deterministic mock reviews ─────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rand(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export type Review = {
  reviews: number;
  rating: number; // 0..5
  happy: number; // %
  mixed: number;
  unhappy: number;
  pros: string[];
  cons: string[];
  blurb: string;
};

const PROS_BY_TAG: Record<string, string> = {
  waterproof: "Shrugs off rain & sleet",
  windproof: "Blocks alpine wind",
  breathable: "Breathes well on the climb",
  "gore-tex": "Trusted Gore-Tex membrane",
  insulated: "Toasty even when standing still",
  packable: "Stuffs into its own pocket",
  ultralight: "Disappears in your pack",
  durable: "Built like a tank",
  "merino-wool": "No-stink merino comfort",
  vibram: "Vibram grip on wet rock",
  "puncture-resistant": "Tough underfoot",
};
const CONS_BY_CAT: Record<string, string[]> = {
  hardshell: ["Stiff out of the box", "Hood is a little fiddly", "Pit zips could be longer"],
  "rain-jacket": ["Not the most breathable", "Feels a bit clammy at high effort"],
  "insulated-jacket": ["Runs warm above 5°C", "Outer shell snags on branches"],
  fleece: ["Picks up burrs", "Not very wind resistant"],
  "base-layer": ["Sizing runs small", "Thinner than expected"],
  boots: ["Long break-in period", "Heavier than competitors"],
  "approach-shoes": ["Laces could be longer", "Footbed wears quickly"],
  "trail-shoes": ["Outsole compound wears fast", "Narrow toe box"],
  backpack: ["Hip belt padding is thin", "Top lid pocket is small"],
  tent: ["Footprint sold separately", "Condensation in humid weather"],
  "sleeping-bag": ["Bulky stuff sack", "Zipper snags occasionally"],
  "sleeping-mat": ["Crinkly when you move", "Slow to inflate"],
  stove: ["Wind drops the boil time", "Pot supports flex under load"],
  headlamp: ["Battery indicator is vague", "Strap loosens over time"],
  "trekking-poles": ["Locks need occasional tightening", "Cork grips darken with use"],
  trousers: ["Cut runs slim", "Limited stretch"],
  socks: ["Heel can slide on long days"],
  gloves: ["Touchscreen tips are hit-or-miss"],
  hat: ["Brim a bit floppy"],
  tarp: ["Needs trekking poles or trees"],
  "water-bottle": ["Hard to clean threads"],
};

export function reviewFor(p: Product): Review {
  const r = rand(hashStr(p.product_id));
  const reviews = 28 + Math.floor(r() * 480);
  const happy = 55 + Math.floor(r() * 40);
  const unhappy = Math.floor(r() * (100 - happy) * 0.6);
  const mixed = 100 - happy - unhappy;
  const rating = +(2.5 + (happy / 100) * 2.5).toFixed(1);
  const pros = p.tags
    .map((t) => PROS_BY_TAG[t])
    .filter(Boolean)
    .slice(0, 3);
  if (pros.length < 2) pros.push("Holds up trip after trip");
  const consPool = CONS_BY_CAT[p.category] ?? ["Some quirks but solid overall"];
  const cons = [consPool[Math.floor(r() * consPool.length)]];
  if (consPool.length > 1) cons.push(consPool[(Math.floor(r() * consPool.length) + 1) % consPool.length]);
  const blurb =
    happy >= 85
      ? `Owners rave about this ${p.category.replace("-", " ")}. Most reviewers reach for it as a default.`
      : happy >= 70
      ? `A dependable ${p.category.replace("-", " ")} with a few honest trade-offs.`
      : `Mixed reviews — it works, but you'll want to weigh the trade-offs first.`;
  return { reviews, rating, happy, mixed, unhappy, pros, cons: Array.from(new Set(cons)), blurb };
}

export function formatPrice(p: Product): string {
  const eff = p.price_chf * (1 - (p.discount_pct ?? 0) / 100);
  return `CHF ${eff.toFixed(0)}`;
}

const CATEGORY_EMOJI: Record<string, string> = {
  hardshell: "🧥", "rain-jacket": "🧥", "insulated-jacket": "🧥", fleece: "🧥",
  "base-layer": "👕", trousers: "👖", socks: "🧦", gloves: "🧤", hat: "🧢",
  boots: "🥾", "approach-shoes": "👟", "trail-shoes": "👟",
  backpack: "🎒", tent: "⛺", tarp: "⛺", "sleeping-bag": "🛏️", "sleeping-mat": "🛏️",
  stove: "🔥", headlamp: "🔦", "trekking-poles": "🥢", "water-bottle": "💧",
};
export function emojiFor(p: Product): string {
  return CATEGORY_EMOJI[p.category] ?? "🎒";
}

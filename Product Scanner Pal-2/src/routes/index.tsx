import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PRODUCTS,
  FILTERS,
  type Product,
  reviewFor,
  formatPrice,
  emojiFor,
  groupVariants,
} from "@/lib/products";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SampleScene } from "@/components/SampleScene";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrailScope — Point. Filter. Find your gear." },
      {
        name: "description",
        content:
          "Point your phone at the shelf. TrailScope uses AR to highlight only the outdoor gear that matches your filter — waterproof shells, boots in your size, gear rated for −10°C.",
      },
      { property: "og:title", content: "TrailScope" },
      {
        property: "og:description",
        content: "AR shelf scanner that highlights only the gear matching your filter.",
      },
    ],
  }),
  component: Index,
});

// Catalog lookup by scanned barcode
const PRODUCT_BY_CODE = new Map(PRODUCTS.map((p) => [p.product_code, p]));

// ───────────────────────────── Page ─────────────────────────────
function Index() {
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [filterIds, setFilterIds] = useState<string[]>([]);
  const activeFilters = useMemo(
    () => FILTERS.filter((f) => filterIds.includes(f.id)),
    [filterIds],
  );
  const hasFilter = activeFilters.length > 0;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [findTarget, setFindTarget] = useState<Product | null>(null);

  // Resolve scanned codes to Products (skip codes not in catalog)
  const scanned = useMemo(
    () =>
      scannedCodes
        .map((c) => PRODUCT_BY_CODE.get(c))
        .filter((p): p is Product => Boolean(p)),
    [scannedCodes],
  );

  const matchSet = useMemo(() => {
    if (!hasFilter) return new Set(scanned.map((p) => p.product_code));
    return new Set(
      scanned
        .filter((p) => activeFilters.every((f) => f.test(p)))
        .map((p) => p.product_code),
    );
  }, [activeFilters, hasFilter, scanned]);

  const matchCount = matchSet.size;
  const selected = selectedCode ? PRODUCT_BY_CODE.get(selectedCode) ?? null : null;

  const handleScanned = useCallback((code: string) => {
    setScannedCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
  }, []);

  const handleTap = useCallback((code: string) => {
    if (PRODUCT_BY_CODE.has(code)) setSelectedCode(code);
  }, []);

  const togglePick = useCallback((id: string | null) => {
    if (id === null) {
      setFilterIds([]);
      return;
    }
    setFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  // Stable toneFor identity per filter set — used by the camera to know when to reset
  const toneFor = useCallback(
    (code: string): "match" | "dim" | "neutral" | null => {
      const p = PRODUCT_BY_CODE.get(code);
      if (!p) return null; // not in our catalog → no highlight
      if (!hasFilter) return "neutral";
      return activeFilters.every((f) => f.test(p)) ? "match" : "dim";
    },
    [activeFilters, hasFilter],
  );

  useEffect(() => {
    if (hasFilter) setSheetOpen(true);
  }, [hasFilter]);

  if (findTarget) {
    return <FindView target={findTarget} onExit={() => setFindTarget(null)} />;
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Sample shelf scene (demo mode — no live camera) */}
      <SampleScene
        className="fixed inset-0 z-0"
        toneFor={toneFor}
        onScanned={handleScanned}
        onTap={handleTap}
      />

      <TopBar scanned={scanned.length} />
      <FilterBar activeIds={filterIds} onPick={togglePick} matchCount={matchCount} />

      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-black/30 ring-1 ring-white/10 hover:bg-primary/90"
      >
        ▲ {matchCount} match{matchCount === 1 ? "" : "es"} · {scanned.length} scanned
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="h-[78vh] rounded-t-2xl border-t-4 border-t-moss bg-background p-0"
        >
          <ResultsSheet
            scanned={scanned}
            matchSet={matchSet}
            hasFilter={hasFilter}
            onPick={(p) => {
              setSelectedCode(p.product_code);
            }}
          />
        </SheetContent>
      </Sheet>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedCode(null)}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          {selected && (
            <ProductDetail
              product={selected}
              onFind={() => {
                setSelectedCode(null);
                setSheetOpen(false);
                setFindTarget(selected);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

// ───────────────────────────── Top bar ─────────────────────────────
function TopBar({ scanned }: { scanned: number }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
      <div className="flex items-center gap-2 text-paper">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-moss text-paper font-display font-bold">
          T
        </div>
        <div className="leading-tight">
          <div className="font-display text-base font-semibold">TrailScope</div>
          <div className="font-mono text-[10px] uppercase tracking-widest opacity-80">
            MatrixScan AR · DEMO
          </div>
        </div>
      </div>
      <div className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium text-paper backdrop-blur">
        {scanned} scanned
      </div>
    </header>
  );
}

// ───────────────────────────── Filter bar ─────────────────────────────
function FilterBar({
  activeIds,
  onPick,
  matchCount,
}: {
  activeIds: string[];
  onPick: (id: string | null) => void;
  matchCount: number;
}) {
  const hasActive = activeIds.length > 0;
  return (
    <div className="fixed top-14 left-0 right-0 z-30 px-3">
      <div className="mx-auto max-w-3xl">
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip
            active={!hasActive}
            onClick={() => onPick(null)}
            label="All"
            icon="✻"
          />
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              active={activeIds.includes(f.id)}
              onClick={() => onPick(f.id)}
              label={f.label}
              icon={f.icon}
            />
          ))}
        </div>
        {hasActive && (
          <div className="font-mono text-[10px] uppercase tracking-widest text-paper/90 drop-shadow">
            ● {matchCount} match{matchCount === 1 ? "" : "es"} · {activeIds.length} filter{activeIds.length === 1 ? "" : "s"} active
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur transition",
        active
          ? "border-moss bg-moss text-paper shadow"
          : "border-white/25 bg-black/45 text-paper hover:border-tan/70 hover:bg-black/60",
      )}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </button>
  );
}

// ───────────────────────────── Results sheet ─────────────────────────────
function ResultsSheet({
  scanned,
  matchSet,
  hasFilter,
  onPick,
}: {
  scanned: Product[];
  matchSet: Set<string>;
  hasFilter: boolean;
  onPick: (p: Product) => void;
}) {
  const matches = scanned
    .filter((p) => matchSet.has(p.product_code))
    .map((p) => ({ p, r: reviewFor(p) }))
    .sort((a, b) => b.r.rating - a.r.rating);
  const rest = hasFilter
    ? scanned
        .filter((p) => !matchSet.has(p.product_code))
        .map((p) => ({ p, r: reviewFor(p) }))
        .sort((a, b) => b.r.rating - a.r.rating)
    : [];
  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="px-5 pt-4 pb-2">
        <SheetTitle className="font-display text-xl">
          On the shelf in front of you
        </SheetTitle>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {hasFilter
            ? "Best-rated first · grayed items don't match your filter"
            : "Pick a filter above to narrow these down"}
        </p>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {scanned.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Point your camera at the shelf — products will appear here as they're scanned.
          </div>
        )}
        {matches.length > 0 && (
          <SectionLabel tone="green">
            {hasFilter ? `Matches · ${matches.length}` : `Scanned · ${matches.length}`}
          </SectionLabel>
        )}
        <ul className="space-y-2">
          {matches.map(({ p, r }) => (
            <ResultRow key={p.product_code} p={p} r={r} tone="green" onClick={() => onPick(p)} />
          ))}
        </ul>
        {rest.length > 0 && (
          <SectionLabel tone="gray">Other gear scanned · {rest.length}</SectionLabel>
        )}
        <ul className="space-y-2">
          {rest.map(({ p, r }) => (
            <ResultRow key={p.product_code} p={p} r={r} tone="gray" onClick={() => onPick(p)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SectionLabel({ tone, children }: { tone: "green" | "gray"; children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-3 mt-3 mb-2 bg-background/95 px-5 py-2 backdrop-blur">
      <div
        className={cn(
          "font-mono text-[10px] font-bold uppercase tracking-widest",
          tone === "green" ? "text-moss" : "text-muted-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ResultRow({
  p,
  r,
  tone,
  onClick,
}: {
  p: Product;
  r: ReturnType<typeof reviewFor>;
  tone: "green" | "gray";
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition hover:bg-accent/30",
          tone === "green" ? "border-moss/40" : "border-border opacity-70",
        )}
      >
        <div
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-md text-2xl",
            tone === "green" ? "bg-moss/15" : "bg-muted",
          )}
        >
          {emojiFor(p)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate text-sm font-semibold">{p.name}</div>
            <div className="shrink-0 font-mono text-sm font-bold text-forest">
              {formatPrice(p)}
            </div>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{p.brand}</span>
            <span>·</span>
            <span>{p.size}</span>
            <span>·</span>
            <span>{p.color}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <RatingDots happy={r.happy} />
            <span className="font-mono text-[10px] text-muted-foreground">
              {r.happy}% happy · {r.reviews} reviews
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

function RatingDots({ happy }: { happy: number }) {
  const filled = Math.round(happy / 10);
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < filled
              ? happy >= 80
                ? "bg-moss"
                : happy >= 65
                ? "bg-tan"
                : "bg-rust"
              : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

// ───────────────────────────── Product detail ─────────────────────────────
function ProductDetail({ product, onFind }: { product: Product; onFind: () => void }) {
  const group = groupVariants(PRODUCTS).get(product.product_id)!;
  const r = reviewFor(product);
  const [picked, setPicked] = useState(product.size);

  return (
    <div className="max-h-[88vh] overflow-y-auto bg-background">
      <div className="topo-bg relative px-5 py-6 text-paper">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest opacity-80">
              {product.brand} · {product.zone_name}
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">
              {product.name}
            </h2>
            <div className="mt-1 text-xs opacity-90">{product.material}</div>
          </div>
          <div className="text-5xl">{emojiFor(product)}</div>
        </div>
        <div className="mt-3 inline-flex rounded-md bg-paper px-3 py-1 font-mono text-sm font-bold text-forest">
          {formatPrice(product)}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <section>
          <SectionTitle>Available sizes</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {group.sizes.map((s) => {
              const oos = s.stock === 0;
              const isPicked = s.size === picked;
              return (
                <button
                  key={s.code}
                  disabled={oos}
                  onClick={() => setPicked(s.size)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                    isPicked
                      ? "border-forest bg-forest text-paper"
                      : oos
                      ? "cursor-not-allowed border-dashed border-border text-muted-foreground line-through"
                      : "border-border bg-card hover:border-forest",
                  )}
                >
                  {s.size}
                  <span className="ml-1 font-mono text-[9px] opacity-70">
                    {oos ? "—" : `${s.stock}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-lg border bg-card p-4">
          <HappinessPie happy={r.happy} mixed={r.mixed} unhappy={r.unhappy} />
          <div>
            <div className="font-display text-2xl font-bold text-forest">
              {r.happy}
              <span className="text-sm font-medium text-muted-foreground">% happy</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {r.reviews} verified reviews · ⭐ {r.rating}
            </div>
            <p className="mt-1.5 text-xs text-foreground/80">{r.blurb}</p>
          </div>
        </section>

        <section>
          <SectionTitle>Honest breakdown</SectionTitle>
          <div className="mt-2 grid gap-2">
            {r.pros.map((p) => (
              <Line key={p} tone="good">
                {p}
              </Line>
            ))}
            {r.cons.map((c) => (
              <Line key={c} tone="bad">
                {c}
              </Line>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Specs</SectionTitle>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px]">
            <Spec k="Weight" v={product.weight_g ? `${product.weight_g} g` : "—"} />
            <Spec
              k="Waterproof"
              v={product.waterproof_rating_mm ? `${product.waterproof_rating_mm} mm` : "—"}
            />
            <Spec
              k="Temp rating"
              v={product.temp_rating_c !== null ? `${product.temp_rating_c}°C` : "—"}
            />
            <Spec k="Stock" v={`${product.stock_total} in store`} />
          </dl>
        </section>

        <p className="text-sm text-foreground/85">{product.description}</p>

        <Button onClick={onFind} className="w-full bg-rust text-paper hover:bg-rust/90">
          🎯 Find this in store
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}
function Spec({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-semibold text-foreground">{v}</dd>
    </>
  );
}
function Line({ tone, children }: { tone: "good" | "bad"; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        className={cn(
          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold",
          tone === "good" ? "bg-moss text-paper" : "bg-rust/20 text-rust",
        )}
      >
        {tone === "good" ? "+" : "−"}
      </span>
      <span>{children}</span>
    </div>
  );
}

function HappinessPie({
  happy,
  mixed,
  unhappy,
}: {
  happy: number;
  mixed: number;
  unhappy: number;
}) {
  const total = happy + mixed + unhappy || 1;
  const segs = [
    { value: happy, color: "var(--moss)" },
    { value: mixed, color: "var(--tan)" },
    { value: unhappy, color: "var(--rust)" },
  ];
  const r = 32;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="14" />
      {segs.map((s, i) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={i}
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

// ───────────────────────────── Find view ─────────────────────────────
function FindView({ target, onExit }: { target: Product; onExit: () => void }) {
  const [found, setFound] = useState(false);

  const toneFor = useCallback(
    (code: string): "match" | "dim" | null => {
      if (code === target.product_code) return "match";
      return PRODUCT_BY_CODE.has(code) ? "dim" : null;
    },
    [target.product_code],
  );

  const handleScanned = useCallback(
    (code: string) => {
      if (code === target.product_code) setFound(true);
    },
    [target.product_code],
  );

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      <SampleScene
        className="fixed inset-0 z-0"
        toneFor={toneFor}
        onScanned={handleScanned}
      />

      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
        <button
          onClick={onExit}
          className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium text-paper backdrop-blur hover:bg-white/25"
        >
          ← Back to scan
        </button>
        <div className="text-right text-paper">
          <div className="font-mono text-[10px] uppercase tracking-widest opacity-80">
            MatrixScan Find
          </div>
          <div className="font-display text-sm font-semibold">
            Aisle {target.aisle} · {target.zone_name}
          </div>
        </div>
      </header>

      {found && (
        <div className="fixed top-20 left-1/2 z-30 -translate-x-1/2 rounded-full bg-moss px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-paper shadow-lg">
          ● Target in view
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 z-30 w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-background p-3 shadow-2xl ring-1 ring-border">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-rust/15 text-2xl">
            {emojiFor(target)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{target.name}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Walk to <span className="text-rust">Aisle {target.aisle}</span> · scan to confirm
            </div>
          </div>
          <div className="font-mono text-sm font-bold text-forest">{formatPrice(target)}</div>
        </div>
      </div>
    </main>
  );
}

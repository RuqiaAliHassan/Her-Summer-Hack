import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import sampleShelf from "@/assets/sample-shelf.jpg";

type HighlightTone = "match" | "dim" | "neutral" | null;

export type SampleSceneProps = {
  toneFor: (code: string) => HighlightTone;
  onScanned?: (code: string) => void;
  onTap?: (code: string) => void;
  className?: string;
};

// Hotspots aligned to the QR codes on the Scandit demo shoe shelf page.
// Codes are the actual values decoded from the QR symbols in sample-barcodes.pdf p.16.
const SPOTS: { code: string; x: number; y: number; label: string }[] = [
  { code: "127396746875", x: 0.291, y: 0.22, label: "Featherpath Trail Shoe" },
  { code: "220607960340", x: 0.609, y: 0.22, label: "Trailfox GTX Hiking Boot" },
  { code: "621601539983", x: 0.926, y: 0.22, label: "Hydra Aqua Runner" },
  { code: "566275535035", x: 0.291, y: 0.493, label: "Granite Approach Shoe" },
  { code: "155989995167", x: 0.609, y: 0.493, label: "Summit Trail Runner" },
  { code: "915010806733", x: 0.926, y: 0.493, label: "Alpine Speed GTX" },
  { code: "422867137693", x: 0.291, y: 0.765, label: "Ridgeline Approach" },
  { code: "680913419876", x: 0.609, y: 0.765, label: "Shadow Trail Low" },
  { code: "769067431255", x: 0.926, y: 0.765, label: "Glacier Trail Shoe" },
];

export function SampleScene({ toneFor, onScanned, onTap, className }: SampleSceneProps) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;

  // Stagger "scan" events so the UI populates progressively, mimicking AR detection.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    SPOTS.forEach((spot, i) => {
      timers.push(
        setTimeout(() => {
          setRevealed((prev) => {
            if (prev.has(spot.code)) return prev;
            const next = new Set(prev);
            next.add(spot.code);
            return next;
          });
          onScannedRef.current?.(spot.code);
        }, 250 + i * 220),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={cn("relative", className)} style={{ inset: 0 }}>
      <div className="absolute inset-0 overflow-hidden bg-black">
        <img
          src={sampleShelf}
          alt="Sample outdoor gear shelf used for AR demo"
          className="h-full w-full object-cover"
          draggable={false}
        />
        {/* subtle scan-line shimmer to feel AR-ish */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.03] to-transparent" />

        {SPOTS.map((s) => {
          if (!revealed.has(s.code)) return null;
          const tone = toneFor(s.code);
          if (tone === null) return null;
          const styles =
            tone === "match"
              ? {
                  ring: "ring-2 ring-[#a8c47e]",
                  bg: "bg-[#4f6b3a]/70",
                  dot: "bg-[#dcebbf]",
                }
              : tone === "dim"
                ? {
                    ring: "ring-1 ring-white/30",
                    bg: "bg-black/40",
                    dot: "bg-white/50",
                  }
                : {
                    ring: "ring-2 ring-[#e6c98a]",
                    bg: "bg-[#c9a966]/40",
                    dot: "bg-[#f1e2bd]",
                  };
          const size = tone === "match" ? 56 : 40;
          return (
            <button
              key={s.code}
              onClick={() => onTap?.(s.code)}
              aria-label={s.label}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full backdrop-blur-sm transition-transform hover:scale-110",
                styles.bg,
                styles.ring,
              )}
              style={{
                left: `${s.x * 100}%`,
                top: `${s.y * 100}%`,
                width: size,
                height: size,
                animation: "trailscope-pulse 1.8s ease-in-out infinite",
              }}
            >
              <span
                className={cn(
                  "absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  styles.dot,
                )}
              />
              {tone === "match" && (
                <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-[#4f6b3a] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white">
                  match
                </span>
              )}
            </button>
          );
        })}
      </div>
      <style>{`@keyframes trailscope-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(168,196,126,0.0); }
        50% { box-shadow: 0 0 0 6px rgba(168,196,126,0.15); }
      }`}</style>
    </div>
  );
}

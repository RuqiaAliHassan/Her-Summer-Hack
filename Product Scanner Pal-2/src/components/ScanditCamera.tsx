import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getScanditLicenseKey } from "@/lib/scandit.functions";

// Scandit SDK version we installed. Update if bumping the package.
const SCANDIT_VERSION = "8.4.0";
const LIBRARY_LOCATION = `https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@${SCANDIT_VERSION}/sdc-lib/`;

type HighlightTone = "match" | "dim" | "neutral" | null;

export type ScanditCameraProps = {
  /** Decide what color/tone a scanned barcode should get. Return null to hide. */
  toneFor: (code: string) => HighlightTone;
  /** Called once per unique barcode seen in this session. */
  onScanned?: (code: string) => void;
  /** Called when the user taps a highlight. */
  onTap?: (code: string) => void;
  className?: string;
};

// Module-level singleton so we don't re-init the SDK between camera mounts.
let contextReady: Promise<void> | null = null;
async function initContext(licenseKey: string) {
  if (contextReady) return contextReady;
  contextReady = (async () => {
    const { DataCaptureContext } = await import("@scandit/web-datacapture-core");
    const { barcodeCaptureLoader } = await import(
      "@scandit/web-datacapture-barcode"
    );
    await DataCaptureContext.forLicenseKey(licenseKey, {
      libraryLocation: LIBRARY_LOCATION,
      moduleLoaders: [barcodeCaptureLoader()],
    });
  })();
  return contextReady;
}

export function ScanditCamera({
  toneFor,
  onScanned,
  onTap,
  className,
}: ScanditCameraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchKey = useServerFn(getScanditLicenseKey);

  // Keep latest callbacks/props accessible from SDK callbacks without re-creating the view.
  const toneRef = useRef(toneFor);
  const onScannedRef = useRef(onScanned);
  const onTapRef = useRef(onTap);
  toneRef.current = toneFor;
  onScannedRef.current = onScanned;
  onTapRef.current = onTap;

  // The current AR view, exposed so the provider-version effect below can reset it.
  const viewRef = useRef<{
    arView: { reset: () => void; stop: () => Promise<void>; remove: () => void } | null;
  }>({ arView: null });
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => Promise<void>) | null = null;

    (async () => {
      try {
        const { licenseKey } = await fetchKey();
        if (cancelled) return;

        await initContext(licenseKey);
        if (cancelled) return;

        const [
          { DataCaptureContext },
          {
            BarcodeAr,
            BarcodeArSettings,
            BarcodeArView,
            BarcodeArCircleHighlight,
            BarcodeArCircleHighlightPreset,
            Symbology,
          },
          { Brush, Color },
        ] = await Promise.all([
          import("@scandit/web-datacapture-core"),
          import("@scandit/web-datacapture-barcode"),
          import("@scandit/web-datacapture-core"),
        ]);

        const settings = new BarcodeArSettings();
        settings.enableSymbologies([
          Symbology.EAN13UPCA,
          Symbology.EAN8,
          Symbology.UPCE,
          Symbology.Code39,
          Symbology.Code93,
          Symbology.Code128,
          Symbology.InterleavedTwoOfFive, // ITF-14, common on shoe boxes
          Symbology.GS1Databar,
          Symbology.GS1DatabarExpanded,
          Symbology.QR,
          Symbology.DataMatrix,
        ]);

        const barcodeAr = await BarcodeAr.forContext(
          DataCaptureContext.sharedInstance,
          settings,
        );

        const seen = new Set<string>();
        barcodeAr.addListener({
          didUpdateSession: (_b, session) => {
            for (const tracked of Object.values(session.addedTrackedBarcodes)) {
              const code = tracked.barcode.data;
              if (!code || seen.has(code)) continue;
              seen.add(code);
              onScannedRef.current?.(code);
            }
          },
        });

        if (!containerRef.current || cancelled) return;
        const arView = await BarcodeArView.create(
          containerRef.current,
          DataCaptureContext.sharedInstance,
          barcodeAr,
        );
        if (cancelled) {
          arView.remove();
          return;
        }
        viewRef.current.arView = arView as unknown as typeof viewRef.current.arView;

        const matchBrush = new Brush(
          Color.fromHex("#4f6b3a"), // moss fill (semi)
          Color.fromHex("#a8c47e"), // light moss stroke
          3,
        );
        const dimBrush = new Brush(
          Color.fromHex("#80808066"),
          Color.fromHex("#9999994d"),
          2,
        );
        const neutralBrush = new Brush(
          Color.fromHex("#c9a96655"),
          Color.fromHex("#e6c98a"),
          2,
        );

        arView.highlightProvider = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          highlightForBarcode: ((barcode: any, callback: any) => {
            const code: string = barcode?.data ?? "";
            const tone = toneRef.current(code);
            if (tone === null) return callback(null);
            const highlight = BarcodeArCircleHighlight.create(
              barcode,
              tone === "match"
                ? BarcodeArCircleHighlightPreset.Icon
                : BarcodeArCircleHighlightPreset.Dot,
            );
            highlight.brush =
              tone === "match" ? matchBrush : tone === "dim" ? dimBrush : neutralBrush;
            callback(highlight);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
        };

        arView.listener = {
          didTapHighlightForBarcode: (_view: unknown, barcode: { data: string | null }) => {
            if (barcode.data) onTapRef.current?.(barcode.data);
          },
        };

        await arView.start();

        cleanup = async () => {
          try {
            await arView.stop();
          } catch {}
          arView.remove();
        };
      } catch (err) {
        console.error("[Scandit] init failed", err);
        if (errorRef.current) {
          const name = (err as { name?: string })?.name;
          const msg =
            name === "NotAllowedError"
              ? "Camera permission denied. Open this preview in a new tab and allow camera access."
              : err instanceof Error
                ? err.message
                : "Camera failed to start";
          errorRef.current.textContent = msg;
          errorRef.current.style.display = "block";
        }
      }
    })();

    return () => {
      cancelled = true;
      void cleanup?.();
      viewRef.current.arView = null;
    };
  }, [fetchKey]);

  // When `toneFor` identity changes (e.g. filter switched), reset the AR view so it
  // re-queries the provider for every tracked barcode.
  useEffect(() => {
    viewRef.current.arView?.reset();
  }, [toneFor]);

  return (
    <div className={className} style={{ position: "relative", inset: 0 }}>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, background: "#000" }}
      />
      <div
        ref={errorRef}
        style={{
          display: "none",
          position: "absolute",
          left: 12,
          right: 12,
          top: 80,
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(120, 30, 30, 0.92)",
          color: "white",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          zIndex: 50,
        }}
      />
    </div>
  );
}

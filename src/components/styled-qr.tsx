"use client";
import { useMemo, useRef } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

/**
 * A QR code drawn by us instead of the stock black squares: round dots, rounded "eyes", the brand's green, and a gift badge in the middle
 * (the code is built with the highest error correction, so the badge never stops it scanning).
 */
export function StyledQr({ url, size = 220, label = "QR code for your referral link" }: { url: string; size?: number; label?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const { n, dots } = useMemo(() => {
    const q = QRCode.create(url, { errorCorrectionLevel: "H" });
    const n = q.modules.size, mid = n / 2, half = 4;
    const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const centre = (r: number, c: number) => Math.abs(r + 0.5 - mid) <= half && Math.abs(c + 0.5 - mid) <= half;
    const dots: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.get(r, c) && !finder(r, c) && !centre(r, c)) dots.push([r, c]);
    return { n, dots };
  }, [url]);
  const pad = 2, N = n + pad * 2, mid = N / 2;
  const eyes: [number, number][] = [[pad, pad], [pad + n - 7, pad], [pad, pad + n - 7]];
  const download = () => {
    const svg = ref.current; if (!svg) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })); a.download = "referral-qr.svg"; a.click();
  };
  return (
    <figure className="qr-fig">
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${N} ${N}`} width={size} height={size} role="img" aria-label={label}>
        <rect width={N} height={N} rx="2.6" fill="#fff" />
        {dots.map(([r, c]) => <circle key={`${r}-${c}`} cx={c + pad + 0.5} cy={r + pad + 0.5} r="0.46" fill="#14170f" />)}
        {eyes.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx="2.2" fill="none" stroke="#14170f" strokeWidth="1" />
            <rect x={x + 2} y={y + 2} width="3" height="3" rx="1.1" fill="#14170f" />
          </g>
        ))}
        <circle cx={mid} cy={mid} r="3.2" fill="#14170f" />
        <g transform={`translate(${mid - 1.5} ${mid - 1.5}) scale(.125)`} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </g>
      </svg>
      <figcaption>Point a phone camera at it<button type="button" onClick={download}><Download size={14} aria-hidden /> Save</button></figcaption>
    </figure>
  );
}

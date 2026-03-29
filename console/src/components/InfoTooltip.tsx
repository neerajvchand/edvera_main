import { Info } from "lucide-react";
import { type ReactNode, useRef, useState, useCallback, useEffect } from "react";

type TooltipPos = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Highlights legal references (EC §xxxxx, CA Education Code §xxxxx)
 * in gray-400 to de-emphasize them within tooltip text.
 */
function highlightLegalRefs(text: string): ReactNode[] {
  const parts = text.split(
    /((?:EC|CA Education Code) §[\d.]+(?:\([a-z]\)(?:\(\d+\))?)?)/g
  );
  return parts.map((part, i) =>
    /(?:EC|CA Education Code) §/.test(part) ? (
      <span key={i} className="text-gray-400">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/**
 * Contextual "how is this calculated?" tooltip.
 *
 * Renders a 14px lucide Info icon (gray-400 → gray-600 on hover).
 * On hover (desktop, 150ms delay) or tap (mobile, via focus), shows a
 * tooltip card with a brief explanation of the metric.
 *
 * Smart positioning — on mouseenter / focus, measures the icon's position
 * relative to the viewport and picks one of four quadrants:
 *   top-left    (default)  — tooltip above icon, extending right
 *   top-right              — tooltip above icon, extending left
 *   bottom-left            — tooltip below icon, extending right
 *   bottom-right           — tooltip below icon, extending left
 *
 * This prevents clipping on right-side table columns and near-top elements.
 */
export function InfoTooltip({ text }: { text: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos>("top-left");

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const computePos = useCallback((): TooltipPos => {
    if (!btnRef.current) return "top-left";
    const rect = btnRef.current.getBoundingClientRect();
    const horiz: "left" | "right" =
      rect.left > window.innerWidth * 0.6 ? "right" : "left";
    const vert: "top" | "bottom" =
      rect.top < window.innerHeight * 0.2 ? "bottom" : "top";
    return `${vert}-${horiz}` as TooltipPos;
  }, []);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPos(computePos());
    timerRef.current = window.setTimeout(() => setVisible(true), 150);
  }, [computePos]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Position-dependent class maps                                       */
  /* ------------------------------------------------------------------ */

  const cardClasses: Record<TooltipPos, string> = {
    "top-left": "bottom-full mb-2 left-0",
    "top-right": "bottom-full mb-2 right-0",
    "bottom-left": "top-full mt-2 left-0",
    "bottom-right": "top-full mt-2 right-0",
  };

  // Arrow: for top-* → points DOWN (sits below tooltip card).
  //        for bottom-* → points UP (sits above tooltip card).
  // Horizontal: offset from the left or right edge so the tip
  // aligns roughly with the center of the 14px icon.
  const arrowClasses: Record<TooltipPos, string> = {
    "top-left":
      "absolute top-full left-[7px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white",
    "top-right":
      "absolute top-full right-[7px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white",
    "bottom-left":
      "absolute bottom-full left-[7px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white",
    "bottom-right":
      "absolute bottom-full right-[7px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white",
  };

  return (
    <span
      className="relative inline-flex items-center ml-1"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        ref={btnRef}
        className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
        aria-label="How is this calculated?"
        onFocus={show}
        onBlur={hide}
      >
        <Info size={14} />
      </button>

      {/* Tooltip card */}
      <span
        className={[
          "absolute",
          cardClasses[pos],
          "w-max max-w-[280px] p-3",
          "bg-white rounded-lg shadow-lg border border-gray-100",
          "text-[13px] font-normal normal-case tracking-normal",
          "text-gray-700 leading-relaxed",
          visible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
          "transition-opacity duration-150",
          "z-50",
        ].join(" ")}
        role="tooltip"
      >
        {highlightLegalRefs(text)}

        {/* Arrow */}
        <span className={arrowClasses[pos]} />
      </span>
    </span>
  );
}

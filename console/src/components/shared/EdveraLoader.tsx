/**
 * Animated Edvera icon — replaces generic spinners with branded loading state.
 *
 * "thinking" — bars pulse in sequence, checkmark hidden.
 * "complete" — bars solid, checkmark scales in.
 */

interface EdveraLoaderProps {
  variant?: "thinking" | "complete";
  size?: number;
  className?: string;
}

const BAR_COLOR = "#14b8a6";
const NAVY = "#0a1128";

const pulseKeyframes = `
@keyframes edvera-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes edvera-check-in {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
`;

export function EdveraLoader({
  variant = "thinking",
  size = 40,
  className,
}: EdveraLoaderProps) {
  const isThinking = variant === "thinking";

  const barStyle = (delay: number): React.CSSProperties =>
    isThinking
      ? {
          animationName: "edvera-pulse",
          animationDuration: "1.4s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          animationDelay: `${delay}s`,
        }
      : {};

  const checkStyle: React.CSSProperties = isThinking
    ? { opacity: 0 }
    : {
        animationName: "edvera-check-in",
        animationDuration: "0.35s",
        animationTimingFunction: "ease-out",
        animationFillMode: "both",
        transformOrigin: "center",
      };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={isThinking ? "Loading" : "Complete"}
    >
      <style>{pulseKeyframes}</style>

      {/* Background */}
      <rect width="40" height="40" rx="8" fill={NAVY} />

      {/* Bar 1 — top, widest */}
      <rect
        x="8"
        y="12"
        width="24"
        height="4"
        rx="2"
        fill={BAR_COLOR}
        style={barStyle(0)}
      />

      {/* Bar 2 — middle */}
      <rect
        x="8"
        y="19"
        width="19"
        height="4"
        rx="2"
        fill={BAR_COLOR}
        opacity={0.7}
        style={barStyle(0.2)}
      />

      {/* Bar 3 — bottom, shortest */}
      <rect
        x="8"
        y="26"
        width="12"
        height="4"
        rx="2"
        fill={BAR_COLOR}
        opacity={0.45}
        style={barStyle(0.4)}
      />

      {/* Checkmark */}
      <path
        d="M22 27 L26 31 L33 22"
        stroke={BAR_COLOR}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={checkStyle}
      />
    </svg>
  );
}

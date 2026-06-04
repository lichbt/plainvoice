export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <a href="/" className="logo" style={{ fontSize: "1.2rem" }}>
      <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: size, height: size }}>
        <rect className="doc" x="14" y="8" width="36" height="48" rx="5" />
        <line className="ln" x1="22" y1="20" x2="42" y2="20" />
        <line className="ln" x1="22" y1="28" x2="42" y2="28" />
        <line className="ln" x1="22" y1="36" x2="34" y2="36" />
        <path className="chk" style={{ strokeDashoffset: 0 }} d="M24 44 L30 50 L44 34" />
      </svg>
      Plainvoice
    </a>
  );
}

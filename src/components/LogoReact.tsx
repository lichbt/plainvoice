export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <a href="/" className="logo" style={{ fontSize: "1.2rem" }}>
      <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: size, height: size }}>
        <rect className="doc" x="19" y="9" width="26" height="46" rx="5" />
        <line className="ln" x1="24" y1="20" x2="40" y2="20" />
        <line className="ln" x1="24" y1="26" x2="35" y2="26" />
        <path className="inf" d="M23.5 41 C23.5 35.33 30.58 35.33 32 41 C33.42 46.67 40.5 46.67 40.5 41 C40.5 35.33 33.42 35.33 32 41 C30.58 46.67 23.5 46.67 23.5 41 Z" />
      </svg>
      Plainvoice
    </a>
  );
}

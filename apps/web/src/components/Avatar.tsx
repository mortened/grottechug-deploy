import { useState } from "react";

type Props = {
  name: string;
  imageUrl?: string | null;
  size?: number;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => (p[0] ?? "").toUpperCase()).join("");
}

export function Avatar({ name, imageUrl, size = 56 }: Props) {
  const [broken, setBroken] = useState(false);

  if (!imageUrl || broken) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 5,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.06)",
          fontWeight: 900
        }}
        aria-label={name}
        title={name}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      width={size}
      height={size}
      style={{
        borderRadius: 10,
        objectFit: "cover",
        border: "1px solid var(--border)",
        display: "block"
      }}
      onError={() => setBroken(true)}
    />
  );
}
import React from "react";

/**
 * Klasik Windows 98 tarzı SVG ikonlar — emoji yerine kullanılır.
 * Her ikon 32x32 kasa, kalın koyu kontur + düz renkli (retro program ikonu hissi).
 */
export type WinIconName =
  | "home" | "building" | "mall" | "castle"
  | "okey" | "cards" | "globe" | "playcard" | "domino" | "dice"
  | "chat" | "gear" | "key" | "crown" | "download" | "compass"
  | "recycle" | "speaker" | "speakerOff" | "refresh" | "monitor" | "mail";

const O = "#1a1a1a"; // kontur

export function WinIcon({ name, size = 32 }: { name: WinIconName; size?: number }) {
  const common: React.SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    className: "shrink-0 drop-shadow-[1px_2px_1px_rgba(0,0,0,.45)]",
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M16 4 3 15h3v12h8v-8h4v8h8V15h3z" fill="#d9534f" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="13" y="19" width="6" height="8" fill="#8b5a2b" stroke={O} strokeWidth="1.2" />
        </svg>
      );
    case "building":
      return (
        <svg {...common}>
          <rect x="7" y="6" width="18" height="22" fill="#c8c4b8" stroke={O} strokeWidth="1.6" />
          <rect x="10" y="9" width="4" height="4" fill="#7fa8e8" stroke={O} strokeWidth="1" />
          <rect x="18" y="9" width="4" height="4" fill="#7fa8e8" stroke={O} strokeWidth="1" />
          <rect x="10" y="16" width="4" height="4" fill="#7fa8e8" stroke={O} strokeWidth="1" />
          <rect x="18" y="16" width="4" height="4" fill="#7fa8e8" stroke={O} strokeWidth="1" />
          <rect x="13" y="23" width="6" height="5" fill="#8b5a2b" stroke={O} strokeWidth="1.2" />
        </svg>
      );
    case "mall":
      return (
        <svg {...common}>
          <rect x="5" y="12" width="22" height="16" fill="#e8e0cf" stroke={O} strokeWidth="1.6" />
          <path d="M4 12 7 6h18l3 6z" fill="#c0392b" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 6v6M15 6v6M21 6v6" stroke={O} strokeWidth="1.2" />
          <rect x="9" y="18" width="6" height="10" fill="#7fa8e8" stroke={O} strokeWidth="1.2" />
          <rect x="18" y="18" width="5" height="5" fill="#7fa8e8" stroke={O} strokeWidth="1.2" />
        </svg>
      );
    case "castle":
      return (
        <svg {...common}>
          <path d="M5 28V12h3V8h3v4h3V8h3v4h3V8h3v4h3v16z" fill="#b9b4a7" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="13" y="20" width="6" height="8" fill="#4a3728" stroke={O} strokeWidth="1.2" />
          <rect x="8" y="15" width="3" height="3" fill="#7fa8e8" stroke={O} strokeWidth=".9" />
          <rect x="21" y="15" width="3" height="3" fill="#7fa8e8" stroke={O} strokeWidth=".9" />
        </svg>
      );
    case "okey":
      return (
        <svg {...common}>
          <rect x="8" y="3" width="16" height="26" rx="3" fill="#fdf6e3" stroke={O} strokeWidth="1.6" />
          <rect x="8" y="3" width="16" height="7" rx="3" fill="#2e8b57" stroke={O} strokeWidth="1.4" />
          <circle cx="16" cy="17" r="3.4" fill="#c0392b" stroke={O} strokeWidth="1.2" />
          <circle cx="16" cy="24.5" r="1.7" fill="#2e8b57" stroke={O} strokeWidth="1" />
        </svg>
      );
    case "cards":
      return (
        <svg {...common}>
          <rect x="4" y="7" width="14" height="20" rx="2" fill="#fffdf5" stroke={O} strokeWidth="1.6" transform="rotate(-12 11 17)" />
          <rect x="14" y="6" width="14" height="20" rx="2" fill="#fffdf5" stroke={O} strokeWidth="1.6" transform="rotate(10 21 16)" />
          <path d="M21 12c-1.6-2-4 .6-2 2.4l2.2 2 2.2-2c2-1.8.4-4.4-2-2.4z" fill="#c0392b" transform="rotate(10 22 14)" />
        </svg>
      );
    case "globe":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12" fill="#4a90d9" stroke={O} strokeWidth="1.6" />
          <path d="M4 16h24M16 4c4 4 4 20 0 24M16 4c-4 4-4 20 0 24" fill="none" stroke={O} strokeWidth="1.1" />
          <path d="M7 10c3 2 6 2 9 0s6-2 9 0M7 22c3-2 6-2 9 0s6 2 9 0" fill="none" stroke={O} strokeWidth="1" opacity=".7" />
        </svg>
      );
    case "playcard":
      return (
        <svg {...common}>
          <rect x="7" y="4" width="18" height="24" rx="2" fill="#fffdf5" stroke={O} strokeWidth="1.6" />
          <path d="M16 9c-2-2.6-5.4.4-2.6 3.2l2.6 2.4 2.6-2.4C21.4 9.4 18 6.4 16 9z" fill="#c0392b" />
          <path d="M11 20h10M13 24h6" stroke="#2e5fa3" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "domino":
      return (
        <svg {...common}>
          <rect x="4" y="9" width="24" height="14" rx="2" fill="#fdf6e3" stroke={O} strokeWidth="1.6" />
          <path d="M16 9v14" stroke={O} strokeWidth="1.6" />
          <circle cx="9" cy="13" r="1.5" fill={O} /><circle cx="13" cy="19" r="1.5" fill={O} />
          <circle cx="20" cy="12.5" r="1.5" fill={O} /><circle cx="24" cy="16" r="1.5" fill={O} /><circle cx="20" cy="19.5" r="1.5" fill={O} />
        </svg>
      );
    case "dice":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="22" height="22" rx="4" fill="#fffdf5" stroke={O} strokeWidth="1.6" />
          <circle cx="11" cy="11" r="2" fill={O} /><circle cx="21" cy="11" r="2" fill={O} />
          <circle cx="16" cy="16" r="2" fill="#c0392b" />
          <circle cx="11" cy="21" r="2" fill={O} /><circle cx="21" cy="21" r="2" fill={O} />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 7h24v15H13l-6 5v-5H4z" fill="#fdf6e3" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 12h14M9 16h10" stroke="#2e5fa3" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "gear":
      return (
        <svg {...common}>
          <path d="M16 3l2 3.6 4-1.2 1 3.9 4.2.3-.6 4.1 3.4 2.3-2.6 3.2 1.8 3.8-4 1.3-.7 4.2-4.2-.6L16 32l-2-3.6-4 1.2-1-3.9-4.2-.3.6-4.1L2 18.9l2.6-3.2L2.8 12l4-1.3.7-4.2 4.2.6z" fill="#9aa0a6" stroke={O} strokeWidth="1.4" strokeLinejoin="round" transform="scale(.92) translate(1.4 -.5)" />
          <circle cx="16" cy="16" r="5" fill="#d4d0c8" stroke={O} strokeWidth="1.5" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="10" cy="12" r="6" fill="none" stroke="#c8a020" strokeWidth="4" />
          <path d="M14 16l12 12M21 23l3-3M24 26l3-3" stroke="#c8a020" strokeWidth="4" strokeLinecap="round" />
          <path d="M14 16l12 12M21 23l3-3M24 26l3-3" stroke={O} strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <circle cx="10" cy="12" r="6" fill="none" stroke={O} strokeWidth="1.3" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M4 22 3 9l7 5 6-9 6 9 7-5-1 13z" fill="#f0c33c" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="4" y="22" width="24" height="5" rx="1" fill="#d9a520" stroke={O} strokeWidth="1.5" />
          <circle cx="16" cy="19" r="1.6" fill="#c0392b" stroke={O} strokeWidth=".9" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M16 4v14M9 13l7 7 7-7" fill="none" stroke="#2e5fa3" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 4v14M9 13l7 7 7-7" fill="none" stroke={O} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="5" y="23" width="22" height="5" rx="1.5" fill="#9aa0a6" stroke={O} strokeWidth="1.5" />
        </svg>
      );
    case "compass":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12" fill="#e8e4d8" stroke={O} strokeWidth="1.6" />
          <path d="M21 11l-3.4 7.6L10 22l3.4-7.6z" fill="#c0392b" stroke={O} strokeWidth="1.3" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="1.6" fill={O} />
        </svg>
      );
    case "recycle":
      return (
        <svg {...common}>
          <path d="M8 10h16l-2 18H10z" fill="#b7b2a5" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6 7h20v3H6z" fill="#9aa0a6" stroke={O} strokeWidth="1.4" />
          <path d="M13 14l1.5 9M19 14l-1.5 9" stroke={O} strokeWidth="1.3" />
          <path d="M13.5 6.5C14 4.6 18 4.6 18.5 6.5" fill="none" stroke={O} strokeWidth="1.3" />
        </svg>
      );
    case "speaker":
      return (
        <svg {...common}>
          <path d="M5 13h5l6-5v16l-6-5H5z" fill="#c8c4b8" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M20 11c2.4 2.6 2.4 7.4 0 10M23.5 8c4 4.4 4 11.6 0 16" fill="none" stroke="#2e5fa3" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "speakerOff":
      return (
        <svg {...common}>
          <path d="M5 13h5l6-5v16l-6-5H5z" fill="#c8c4b8" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M20 12l7 8M27 12l-7 8" stroke="#c0392b" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M26 16a10 10 0 1 1-3-7.1" fill="none" stroke="#2e5fa3" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M26 16a10 10 0 1 1-3-7.1" fill="none" stroke={O} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M23 3v7h-7" fill="none" stroke={O} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="26" height="18" rx="2" fill="#d4d0c8" stroke={O} strokeWidth="1.6" />
          <rect x="6" y="8" width="20" height="12" fill="#2e5fa3" stroke={O} strokeWidth="1.2" />
          <path d="M12 26h8l1-3h-10z" fill="#9aa0a6" stroke={O} strokeWidth="1.4" strokeLinejoin="round" />
          <rect x="9" y="26" width="14" height="2.4" rx="1" fill="#b7b2a5" stroke={O} strokeWidth="1.2" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="26" height="18" rx="1.5" fill="#fdf6e3" stroke={O} strokeWidth="1.6" />
          <path d="M3.5 8 16 18 28.5 8" fill="none" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M3.5 24 12 15.5M28.5 24 20 15.5" fill="none" stroke={O} strokeWidth="1.2" />
        </svg>
      );
  }
}

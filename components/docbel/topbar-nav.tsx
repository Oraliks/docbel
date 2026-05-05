"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  HomeIcon,
  NewsIcon,
  ContactIcon,
  BellIcon,
  ChevronIcon,
  MoonIcon,
  SunIcon,
} from "./icons";

interface NavItemDef {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

const NAV: NavItemDef[] = [
  { id: "accueil", label: "Accueil", Icon: HomeIcon },
  { id: "actualites", label: "Actualités", Icon: NewsIcon },
  { id: "contact", label: "Contact", Icon: ContactIcon },
];

interface TopBarNavProps {
  accent: string;
  dark: boolean;
  setDark: (d: boolean | ((p: boolean) => boolean)) => void;
  activePage: string;
  setActivePage: (p: string) => void;
  userLoggedIn: boolean;
  setShowLoginModal: (s: boolean) => void;
  userName?: string | null;
  userRole?: string | null;
  notificationCount?: number;
}

export function TopBarNav({
  accent,
  dark,
  setDark,
  activePage,
  setActivePage,
  userLoggedIn,
  setShowLoginModal,
  userName,
  userRole,
  notificationCount = 3,
}: TopBarNavProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const initials = (userName || "JD")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex items-center gap-8 px-8 py-3.5 bg-surface border-b border-border shrink-0">
      {/* Logo */}
      <button
        onClick={() => setActivePage("accueil")}
        className="flex items-center gap-2.5 bg-transparent border-none cursor-pointer p-0 shrink-0"
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 800,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ⚖
        </div>
        <span className="text-lg font-black text-foreground" style={{ letterSpacing: "-0.5px" }}>
          Docbel
        </span>
      </button>

      {/* Nav items */}
      <nav className="flex items-center gap-1">
        {NAV.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex items-center gap-1.75 px-3.5 py-2.5 rounded-lg border-none transition-all relative ${
                isActive
                  ? "font-semibold"
                  : "font-medium text-text-muted hover:text-foreground"
              }`}
              style={{
                color: isActive ? accent : undefined,
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <item.Icon size={16} />
              <span className="text-xs">{item.label}</span>
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    bottom: -14,
                    left: 12,
                    right: 12,
                    height: 2,
                    background: accent,
                    borderRadius: 2,
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Right cluster: dark toggle, bell, avatar */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setDark((d) => !d)}
          className="w-9.5 h-9.5 rounded-lg border border-border bg-transparent cursor-pointer text-text-muted flex items-center justify-center transition-all hover:bg-surface-2 hover:text-foreground"
        >
          {dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>

        <button
          className="relative w-9.5 h-9.5 rounded-lg border border-border bg-transparent cursor-pointer text-text-muted flex items-center justify-center transition-all hover:bg-surface-2 hover:text-foreground"
        >
          <BellIcon size={16} />
          {notificationCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 8,
                background: accent,
                color: "white",
                fontSize: 9.5,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid var(--surface)`,
              }}
            >
              {notificationCount}
            </span>
          )}
        </button>

        {userLoggedIn ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setUserMenuOpen((m) => !m)}
              className="flex items-center gap-2 px-2.5 py-1.25 rounded-full border border-border bg-transparent cursor-pointer transition-all hover:bg-surface-2"
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#3B82F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <ChevronIcon size={12} down={!userMenuOpen} />
            </button>

            {userMenuOpen && (
              <div className="absolute top-[calc(100%_+_6px)] right-0 bg-surface border border-border rounded-xl p-1 shadow-lg z-100 min-w-[180px]">
                {userRole === "admin" && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-foreground text-sm font-medium rounded-lg no-underline hover:bg-surface-2 transition-colors"
                  >
                    <span>📊</span> Admin
                  </Link>
                )}
                <button
                  onClick={() => {
                    signOut({ callbackUrl: "/" });
                    setUserMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 bg-transparent text-foreground border-none cursor-pointer text-sm font-medium rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span>🚪</span> Déconnexion
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            style={{
              padding: "9px 18px",
              borderRadius: 9,
              border: "none",
              background: accent,
              color: "white",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Connexion
          </button>
        )}
      </div>
    </header>
  );
}

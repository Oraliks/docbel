"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

interface LoginModalProps {
  accent: string;
  onClose: () => void;
  onLogin: () => void;
}

export function LoginModal({ accent, onClose, onLogin }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password: pwd,
        redirect: false,
      });

      if (!result?.ok) {
        setError(result?.error || "Erreur d'authentification");
        toast.error(result?.error || "Erreur d'authentification");
      } else {
        toast.success("Connexion réussie!");
        onLogin();
        onClose();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-3xl p-9 w-96 shadow-2xl border border-border"
        style={{ "--accent": accent } as React.CSSProperties}
      >
        <div className="text-center mb-7">
          <div
            className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center mx-auto mb-3.5"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-foreground -tracking-0.3">Connexion</h2>
          <p className="text-sm text-muted-foreground mt-1">Accédez à vos documents sauvegardés</p>
        </div>

        {error && (
          <div className="mb-3.5 p-2.5 rounded-lg bg-red-100 text-red-600 text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {([
            ["Email", "email", email, setEmail, "user@example.com"],
            ["Mot de passe", "password", pwd, setPwd, "••••••••"],
          ] as const).map(([label, type, val, setter, ph]) => (
            <div key={label} className="mb-3.5">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {label}
              </label>
              <input
                type={type}
                value={val}
                onChange={(e) => setter(e.target.value)}
                placeholder={ph}
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border bg-input text-foreground text-sm outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:border-[var(--accent)]"
                style={{ "--accent": accent } as React.CSSProperties}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg border-none bg-[var(--accent)] text-white font-bold text-sm mt-1.5 cursor-pointer disabled:opacity-70 transition-opacity"
            style={{ "--accent": accent } as React.CSSProperties}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <div className="text-center mt-4">
          <a href="#" className="text-xs text-[var(--accent)] font-semibold no-underline hover:underline" style={{ "--accent": accent } as React.CSSProperties}>
            Mot de passe oublié ?
          </a>
        </div>

        <div className="text-center mt-5 pt-5 border-t border-border">
          <span className="text-xs text-muted-foreground">Pas encore de compte ? </span>
          <a href="#" className="text-xs text-[var(--accent)] font-bold no-underline hover:underline" style={{ "--accent": accent } as React.CSSProperties}>
            S&apos;inscrire
          </a>
        </div>
      </div>
    </div>
  );
}

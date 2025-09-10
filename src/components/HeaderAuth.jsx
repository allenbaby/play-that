// src/components/HeaderAuth.jsx
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

function extractAvatar(user) {
  const md = user?.user_metadata || {};
  return (
    md.avatar_url ||
    md.picture ||
    md.image_url ||
    user?.identities?.[0]?.identity_data?.avatar_url ||
    user?.identities?.[0]?.identity_data?.picture ||
    null
  );
}

export default function HeaderAuth() {
  const [userEmail, setUserEmail] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();

    sb.auth.getUser().then(({ data }) => {
      const u = data?.user ?? null;
      setUserEmail(u?.email ?? null);
      setAvatarUrl(extractAvatar(u));
    });

    const { data: authListener } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUserEmail(u?.email ?? null);
      setAvatarUrl(extractAvatar(u));
      setLoading(false);
    });

    return () => authListener?.subscription?.unsubscribe?.();
  }, []);

  async function signInWithGoogle() {
    try {
      setLoading(true);
      await supabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      setLoading(true);
      await supabaseBrowser().auth.signOut();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {userEmail ? (
        <>
          {/* Avatar (with next/image) */}
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="avatar"
              width={36}
              height={36}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-[var(--border)] object-cover"
              priority={false}
            />
          ) : (
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--secondary)]">
              <User className="h-4 w-4 text-[var(--secondary-foreground)]" />
            </div>
          )}

          {/* Email (desktop only) */}
          <span
            className="hidden sm:inline text-sm"
            style={{ color: "var(--muted-foreground)" }}
            title={userEmail}
          >
            {userEmail}
          </span>

          {/* Logout button */}
          <Button
            type="button"
            onClick={signOut}
            disabled={loading}
            className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl transition-smooth border"
            style={{
              background: "color-mix(in oklab, var(--secondary) 85%, transparent)",
              color: "var(--secondary-foreground)",
              borderColor: "var(--border)",
            }}
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </>
      ) : (
        <Button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl shadow-sm transition-smooth focus:outline-none"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            boxShadow:
              "0 0 0 0px transparent, 0 8px 24px -10px oklch(0.72 0.18 45 / 45%)",
          }}
        >
          <LogIn className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Sign in with Google</span>
        </Button>
      )}
    </div>
  );
}

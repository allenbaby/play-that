// src/app/_providers/SessionProvider.jsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";

const SessionCtx = createContext({ user: null, loading: true });

export default function SessionProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true });

  useEffect(() => {
    const sb = createClient();
    let unsub = () => {};

    (async () => {
      const { data } = await sb.auth.getSession(); // reads local session/cookies
      setState({ user: data?.session?.user ?? null, loading: false });

      const sub = sb.auth.onAuthStateChange((_e, session) => {
        setState({ user: session?.user ?? null, loading: false });
      });
      unsub = () => sub?.subscription?.unsubscribe?.();
    })();

    return () => unsub();
  }, []);

  return <SessionCtx.Provider value={state}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx); // { user, loading }
}

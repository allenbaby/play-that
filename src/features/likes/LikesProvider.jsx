// src/features/likes/LikesProvider.jsx 
"use client";
import { createContext, useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabaseBrowser";
import { useSession } from "@/app/_providers/SessionProvider";
import { SupabaseClient } from "@supabase/supabase-js";

const LikesCtx = createContext({ likedSet: new Set(), toggleLike: () => {}, isLoading: false });

export default function LikesProvider({ children }) {
  const { user, loading } = useSession();
  const qc = useQueryClient();

  const { data: likedSet, isLoading } = useQuery({
    queryKey: ["favorites", "liked-set", user?.id || "anon"],
    enabled: !loading && !!user,                // wait until user resolved
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("favorites")
        .select("track_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return new Set((data || []).map(r => r.track_id));
    },
    // 🔑 ensures we still fetch immediately on reload
    placeholderData: () => new Set(),           // NOT initialData
    refetchOnMount: "always",                   // or staleTime: 0
    // staleTime: 0,
  });

  const { mutate: toggleLike } = useMutation({
    mutationFn: async ({ trackId, like }) => {
      if (!user) throw new Error("not-authenticated");
      if (like) {
        const { error } = await createClient().from("favorites")
          .insert({ user_id: user.id, track_id: trackId });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await createClient().from("favorites")
          .delete().eq("user_id", user.id).eq("track_id", trackId);
        if (error) throw error;
      }
    },
    onMutate: async ({ trackId, like }) => {
      const key = ["favorites", "liked-set", user?.id || "anon"];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      const next = new Set(prev || []);
      like ? next.add(trackId) : next.delete(trackId);
      qc.setQueryData(key, next);
      return { prev, key };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["favorites", "liked-set", user?.id || "anon"] });
    },
  });

  const value = useMemo(() => ({
    likedSet: likedSet || new Set(),
    toggleLike,
    isLoading,
  }), [likedSet, toggleLike, isLoading]);

  return <LikesCtx.Provider value={value}>{children}</LikesCtx.Provider>;
}

export function useLikes() {
  return useContext(LikesCtx);
}

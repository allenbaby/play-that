// src/app/api/like-counts/route.js
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const body = await req.json();
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) return NextResponse.json({ counts: [] });

  const { data, error } = await supabaseServer().rpc("get_like_counts", { ids });
  if (error) {
    console.error("get_like_counts error", error);
    return NextResponse.json({ counts: [] }, { status: 500 });
  }
  return NextResponse.json({ counts: data });
}

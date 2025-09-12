// app/api/streak/route.js
import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabaseServer';

// READ current streak
export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_streaks')
    .select('current_streak,longest_streak,last_checkin')
    .eq('user_id', user.id)
    .single(); // one row per user

  // PGRST116 => no rows; treat as zeros
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    current: data?.current_streak ?? 0,
    longest: data?.longest_streak ?? 0,
    lastCheckin: data?.last_checkin ?? null,
  });
}

// WRITE: perform idempotent streak check-in (server computes local day)
export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase.rpc('check_in_now');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = data?.[0] ?? null; // { current_streak, longest_streak, last_checkin }
  return NextResponse.json({ ok: true, streak: row });
}

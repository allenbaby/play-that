import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/lib/supabaseServer'
import { DateTime } from 'luxon'

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    let next = searchParams.get('next') ?? '/'
    if (!next.startsWith('/')) {
        // if "next" is not a relative URL, use the default
        next = '/'
    }
    console.log('auth callback, next:', next)

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // ---------- Streak check-in (server-side) ----------
            // 1) get the authed user
            const { data: userRes } = await supabase.auth.getUser()
            const user = userRes?.user
            if (user) {
                // 2) read user's time zone from profiles (default: UTC)
                await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' })
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('time_zone')
                    .eq('id', user.id)
                    .single()
                const tz = profile?.time_zone || 'UTC'
                const today = DateTime.now().setZone(tz).toISODate() // "YYYY-MM-DD"

                // 3) perform idempotent, race-safe check-in
                await supabase.rpc('check_in', { today })
                const { data: rows, error: rpcErr } = await supabase.rpc('check_in', { today })
                if (rpcErr) console.warn('check_in RPC error:', rpcErr.message)
                // If you ever need values:
                const row = rows?.[0] // { current_streak, longest_streak, last_checkin }
                console.log('check_in result:', row)
                // ignore errors here on purpose: never block login UX
            }
            const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
            const isLocalEnv = process.env.NODE_ENV === 'development'
            if (isLocalEnv) {
                // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
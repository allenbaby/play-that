// src/app/auth/callback/route.js
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

export async function GET(request) {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')

    const response = NextResponse.redirect(new URL('/', url.origin))

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            // NEW API (non-deprecated)
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    console.log("Setting cookies in response from auth callback:", cookiesToSet);
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options)
                    })
                },
            },
            headers: {
                get(key) { return request.headers.get(key) },
            },
        }
    )

    if (code) {
        await supabase.auth.exchangeCodeForSession(code) // writes sb-… cookies
    }

    return response
}

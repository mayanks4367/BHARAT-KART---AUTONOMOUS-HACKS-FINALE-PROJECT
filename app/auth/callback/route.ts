import { NextResponse } from 'next/server'

// Firebase handles auth client-side, so this callback just redirects home.
// Kept for backwards compatibility with any existing links.
export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const origin = requestUrl.origin
    return NextResponse.redirect(`${origin}/`)
}

import { NextRequest, NextResponse } from "next/server";

const VALID_LANGUAGES = ["en", "hi", "mr", "bh"] as const;

/** GET: return user language preference (e.g. from cookie). No auth DB; uses cookie for persistence. */
export async function GET(request: NextRequest) {
    const lang = request.cookies.get("language")?.value;
    if (lang && VALID_LANGUAGES.includes(lang as (typeof VALID_LANGUAGES)[number])) {
        return NextResponse.json({ language: lang });
    }
    return NextResponse.json({ language: "en" });
}

/** POST: save language preference in cookie. */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const lang = body?.language;
        if (!lang || !VALID_LANGUAGES.includes(lang)) {
            return NextResponse.json({ error: "Invalid language" }, { status: 400 });
        }
        const res = NextResponse.json({ ok: true });
        res.cookies.set("language", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
        return res;
    } catch {
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import {
    buildHealthInsights,
    safeHealthInsightsLanguage,
    type HealthInsightsInput,
} from "@/lib/ai/health-insights";

const ERROR_BY_LANGUAGE = {
    en: "Failed to generate health insights",
    hi: "स्वास्थ्य सुझाव तैयार नहीं हो पाए",
    mr: "आरोग्य सूचना तयार करण्यात अयशस्वी",
    bh: "स्वास्थ्य सुझाव बनावे में दिक्कत भइल",
} as const;

export async function POST(request: NextRequest) {
    let language: keyof typeof ERROR_BY_LANGUAGE = "en";
    try {
        const body = (await request.json()) as HealthInsightsInput;
        language = safeHealthInsightsLanguage(body?.language);
        const result = buildHealthInsights(body ?? {}, language);
        return NextResponse.json(result);
    } catch (error) {
        console.error("AI health-insights error:", error);
        return NextResponse.json({ error: ERROR_BY_LANGUAGE[language] }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getJourneyByIdFromIdentityRegistry } from "@/lib/server/journey-directory";

// Cache file to store the latest CIDs synced by doctors
const CACHE_FILE = path.join(process.cwd(), ".journey-sync-cache.json");

interface SyncCache {
    [journeyId: string]: {
        cid: string;
        syncedAt: string;
        syncedBy: string;
    };
}

function readCache(): SyncCache {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Failed to read journey sync cache:", error);
    }
    return {};
}

function writeCache(cache: SyncCache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
    } catch (error) {
        console.error("Failed to write journey sync cache:", error);
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { newCid, doctorWallet } = body;

        if (!newCid || !doctorWallet) {
            return NextResponse.json(
                { error: "Missing newCid or doctorWallet in request body." },
                { status: 400 }
            );
        }

        // Verify the journey actually exists before allowing sync
        const existingJourney = await getJourneyByIdFromIdentityRegistry(id);
        if (!existingJourney) {
            return NextResponse.json(
                { error: "Journey not found in registry." },
                { status: 404 }
            );
        }

        // We could add strict allottedDoctorWallet checking here as a security measure
        // if (existingJourney.allottedDoctorWallet?.toLowerCase() !== doctorWallet.toLowerCase()) ...

        // Update the inbox/outbox cache with the latest CID
        const cache = readCache();
        cache[id] = {
            cid: newCid,
            syncedAt: new Date().toISOString(),
            syncedBy: doctorWallet,
        };
        writeCache(cache);

        return NextResponse.json({ success: true, newCid });
    } catch (error) {
        console.error("Error in journey sync:", error);
        return NextResponse.json(
            { error: "Failed to sync journey." },
            { status: 500 }
        );
    }
}

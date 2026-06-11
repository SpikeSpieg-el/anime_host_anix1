import { NextRequest, NextResponse } from "next/server";
import { getAnimeBackdrop } from "@/lib/shikimori/images";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shikimoriId = searchParams.get("shikimoriId");
    const disableExternalAPIs = searchParams.get("disableExternalAPIs") === "true";

    if (!shikimoriId) {
      return NextResponse.json(
        { error: "Missing shikimoriId parameter" },
        { status: 400 }
      );
    }

    console.log(`[Backdrops API] Fetching backdrop for ${shikimoriId} (disableExternalAPIs: ${disableExternalAPIs})`);
    const backdrop = await getAnimeBackdrop(shikimoriId, disableExternalAPIs);

    return NextResponse.json({ backdrop });
  } catch (error) {
    console.error("[Backdrops API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch backdrop" },
      { status: 500 }
    );
  }
}

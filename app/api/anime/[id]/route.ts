import { NextRequest, NextResponse } from "next/server";
import { getAnimeById } from "@/lib/shikimori";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing anime ID" },
        { status: 400 }
      );
    }

    const anime = await getAnimeById(id, false);

    if (!anime) {
      return NextResponse.json(
        { error: "Anime not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(anime);
  } catch (error) {
    console.error("[Anime API] Error fetching anime:", error);
    return NextResponse.json(
      { error: "Failed to fetch anime" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const preferences = await db.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Return default preferences if none exist
      return NextResponse.json({
        preferences: {
          userId,
          tableSettings: {},
        },
      });
    }

    return NextResponse.json({
      preferences: {
        userId: preferences.userId,
        tableSettings: JSON.parse(preferences.tableSettings),
      },
    });
  } catch (error) {
    console.error("GET preferences error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tableSettings } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const settingsJson = typeof tableSettings === "string"
      ? tableSettings
      : JSON.stringify(tableSettings || {});

    const preferences = await db.userPreferences.upsert({
      where: { userId },
      update: {
        tableSettings: settingsJson,
      },
      create: {
        userId,
        tableSettings: settingsJson,
      },
    });

    return NextResponse.json({
      preferences: {
        userId: preferences.userId,
        tableSettings: JSON.parse(preferences.tableSettings),
      },
    });
  } catch (error) {
    console.error("PUT preferences error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

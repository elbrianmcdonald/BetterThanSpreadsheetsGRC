import { NextResponse } from "next/server";
import { db } from "@/server/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "healthy", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}

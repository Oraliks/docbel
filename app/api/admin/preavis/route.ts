import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAdminAuth } from "@/lib/auth-check";

const CONFIG_PATH = path.join(process.cwd(), "lib", "notice-periods-official.json");
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data, { headers: jsonHeaders });
  } catch (error) {
    console.error("GET /api/admin/preavis error:", error);
    return NextResponse.json(
      { error: "Failed to load preavis config" },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function PUT(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: jsonHeaders });
    }

    if (!body.metadata || typeof body.metadata !== "object") {
      return NextResponse.json(
        { error: "Missing metadata block" },
        { status: 400, headers: jsonHeaders }
      );
    }

    const updated = {
      ...body,
      metadata: {
        ...body.metadata,
        lastUpdated: new Date().toISOString().split("T")[0],
      },
    };

    await fs.writeFile(
      CONFIG_PATH,
      JSON.stringify(updated, null, 2) + "\n",
      "utf-8"
    );

    return NextResponse.json(
      { success: true, data: updated },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("PUT /api/admin/preavis error:", error);
    return NextResponse.json(
      { error: "Failed to save preavis config" },
      { status: 500, headers: jsonHeaders }
    );
  }
}

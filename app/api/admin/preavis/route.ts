import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { promises as fs } from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "lib", "notice-periods-official.json");

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("GET /api/admin/preavis error:", error);
    return NextResponse.json(
      { error: "Failed to load preavis config" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!body.metadata) {
      return NextResponse.json(
        { error: "Missing metadata block" },
        { status: 400 }
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
      { headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  } catch (error) {
    console.error("PUT /api/admin/preavis error:", error);
    return NextResponse.json(
      { error: "Failed to save preavis config" },
      { status: 500 }
    );
  }
}

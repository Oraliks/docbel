import { NextRequest, NextResponse } from "next/server";
import { isEmailAuthorized } from "@/lib/partner-domains";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { recognized: false },
      { headers: jsonHeaders },
    );
  }

  const result = await isEmailAuthorized(email);
  if (!result.authorized || !result.organizationName) {
    return NextResponse.json(
      { recognized: false },
      { headers: jsonHeaders },
    );
  }

  return NextResponse.json(
    {
      recognized: true,
      organizationName: result.organizationName,
      isTest: Boolean(result.isTest),
      segment: result.segment ?? "partenaire",
      partnerType: result.partnerType ?? null,
    },
    { headers: jsonHeaders },
  );
}

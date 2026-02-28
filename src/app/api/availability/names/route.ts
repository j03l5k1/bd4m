import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanInput, findMatchingGameIds } from "@/lib/server/availability";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source_key = searchParams.get("source_key");

  if (!source_key) {
    return NextResponse.json({ ok: false, error: "Missing source_key" }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const gameIds = await findMatchingGameIds(source_key);

    if (!gameIds.length) {
      return NextResponse.json({
        ok: true,
        names: { yes: [], maybe: [], no: [] },
      });
    }

    const { data: rows, error: rowsErr } = await sb
      .from("availability")
      .select("status, players(name)")
      .in("game_id", gameIds);

    if (rowsErr) {
      return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 });
    }

    const names = {
      yes: [] as string[],
      maybe: [] as string[],
      no: [] as string[],
    };

    const seen = {
      yes: new Set<string>(),
      maybe: new Set<string>(),
      no: new Set<string>(),
    };

    for (const r of rows || []) {
      const name = cleanInput((r as any)?.players?.name || "");
      if (!name) continue;

      if (r.status === "yes" && !seen.yes.has(name)) {
        seen.yes.add(name);
        names.yes.push(name);
      }

      if (r.status === "maybe" && !seen.maybe.has(name)) {
        seen.maybe.add(name);
        names.maybe.push(name);
      }

      if (r.status === "no" && !seen.no.has(name)) {
        seen.no.add(name);
        names.no.push(name);
      }
    }

    names.yes.sort((a, b) => a.localeCompare(b));
    names.maybe.sort((a, b) => a.localeCompare(b));
    names.no.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ ok: true, names });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

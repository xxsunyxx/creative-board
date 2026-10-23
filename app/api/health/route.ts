import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { canvases, documents, inspirations } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export function GET() {
  const canvasCount =
    db.select({ value: count() }).from(canvases).get()?.value ?? 0;
  const inspirationCount =
    db.select({ value: count() }).from(inspirations).get()?.value ?? 0;
  const documentCount =
    db.select({ value: count() }).from(documents).get()?.value ?? 0;

  return Response.json({
    ok: true,
    counts: {
      canvases: canvasCount,
      inspirations: inspirationCount,
      documents: documentCount,
    },
    at: new Date().toISOString(),
  });
}

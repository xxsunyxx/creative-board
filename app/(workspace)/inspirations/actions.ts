"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { extractKeywords, mergeInspirations } from "@/lib/ai/mock";
import { db } from "@/lib/db";
import {
  canvasNodes,
  canvases,
  inspirationKeywords,
  inspirations,
} from "@/lib/db/schema";

function insertKeywords(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  inspirationId: string,
  keywords: string[],
) {
  for (const keyword of keywords) {
    tx.insert(inspirationKeywords)
      .values({
        id: crypto.randomUUID(),
        inspirationId,
        keyword,
      })
      .run();
  }
}

export async function createInspiration(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title) {
    return;
  }

  const id = crypto.randomUUID();
  const keywords = extractKeywords({ title, content });

  db.transaction((tx) => {
    tx.insert(inspirations)
      .values({
        id,
        title,
        content,
        origin: "manual",
        status: "active",
      })
      .run();

    insertKeywords(tx, id, keywords);
  });

  revalidatePath("/inspirations");
}

export async function addKeyword(formData: FormData) {
  const inspirationId = String(formData.get("inspirationId") ?? "");
  const keyword = String(formData.get("keyword") ?? "")
    .trim()
    .slice(0, 20);

  if (!inspirationId || !keyword) {
    return;
  }

  const existing = db
    .select()
    .from(inspirationKeywords)
    .where(
      and(
        eq(inspirationKeywords.inspirationId, inspirationId),
        eq(inspirationKeywords.keyword, keyword),
      ),
    )
    .get();

  if (existing) {
    return;
  }

  db.insert(inspirationKeywords)
    .values({
      id: crypto.randomUUID(),
      inspirationId,
      keyword,
    })
    .run();

  revalidatePath("/inspirations");
}

export async function deleteKeyword(formData: FormData) {
  const keywordId = String(formData.get("keywordId") ?? "");

  if (!keywordId) {
    return;
  }

  db.delete(inspirationKeywords)
    .where(eq(inspirationKeywords.id, keywordId))
    .run();

  revalidatePath("/inspirations");
}

export async function generateKeywords(formData: FormData) {
  const inspirationId = String(formData.get("inspirationId") ?? "");
  const inspiration = db
    .select()
    .from(inspirations)
    .where(eq(inspirations.id, inspirationId))
    .get();

  if (!inspiration) {
    return;
  }

  const existing = db
    .select()
    .from(inspirationKeywords)
    .where(eq(inspirationKeywords.inspirationId, inspirationId))
    .all();

  const existingSet = new Set(existing.map((row) => row.keyword));
  const candidates = extractKeywords({
    title: inspiration.title,
    content: inspiration.content,
  }).filter((keyword) => !existingSet.has(keyword));

  if (candidates.length === 0) {
    return;
  }

  db.transaction((tx) => {
    insertKeywords(tx, inspirationId, candidates);
  });

  revalidatePath("/inspirations");
}

export async function mergeInspirationsAction(formData: FormData) {
  const firstId = String(formData.get("firstId") ?? "");
  const secondId = String(formData.get("secondId") ?? "");

  if (!firstId || !secondId || firstId === secondId) {
    return;
  }

  const first = db
    .select()
    .from(inspirations)
    .where(eq(inspirations.id, firstId))
    .get();
  const second = db
    .select()
    .from(inspirations)
    .where(eq(inspirations.id, secondId))
    .get();

  if (!first || !second) {
    return;
  }

  const firstKeywords = db
    .select()
    .from(inspirationKeywords)
    .where(eq(inspirationKeywords.inspirationId, firstId))
    .all()
    .map((row) => row.keyword);
  const secondKeywords = db
    .select()
    .from(inspirationKeywords)
    .where(eq(inspirationKeywords.inspirationId, secondId))
    .all()
    .map((row) => row.keyword);

  const merged = mergeInspirations(
    { ...first, keywords: firstKeywords },
    { ...second, keywords: secondKeywords },
  );
  const mergedId = crypto.randomUUID();
  const now = new Date();

  db.transaction((tx) => {
    tx.insert(inspirations)
      .values({
        id: mergedId,
        title: merged.title,
        content: merged.content,
        origin: "merged",
        status: "active",
      })
      .run();

    insertKeywords(tx, mergedId, merged.keywords);

    tx.update(inspirations)
      .set({ status: "merged", mergedInto: mergedId, updatedAt: now })
      .where(eq(inspirations.id, firstId))
      .run();

    tx.update(inspirations)
      .set({ status: "merged", mergedInto: mergedId, updatedAt: now })
      .where(eq(inspirations.id, secondId))
      .run();
  });

  revalidatePath("/inspirations");
}

const nodeColors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];

export async function sendToCanvas(formData: FormData) {
  const inspirationId = String(formData.get("inspirationId") ?? "");
  const canvasId = String(formData.get("canvasId") ?? "");

  if (!inspirationId || !canvasId) {
    return;
  }

  const inspiration = db
    .select()
    .from(inspirations)
    .where(eq(inspirations.id, inspirationId))
    .get();
  const canvas = db
    .select()
    .from(canvases)
    .where(eq(canvases.id, canvasId))
    .get();

  if (!inspiration || !canvas) {
    return;
  }

  const nodeCount =
    db
      .select({ value: count() })
      .from(canvasNodes)
      .where(eq(canvasNodes.canvasId, canvasId))
      .get()?.value ?? 0;

  db.insert(canvasNodes)
    .values({
      id: crypto.randomUUID(),
      canvasId,
      type: "inspiration",
      sourceInspirationId: inspirationId,
      title: inspiration.title,
      content: inspiration.content,
      weight: 5,
      color: nodeColors[nodeCount % nodeColors.length],
      x: 80 + (nodeCount % 3) * 300,
      y: 80 + Math.floor(nodeCount / 3) * 220,
      width: 240,
      height: 160,
    })
    .run();

  revalidatePath("/canvases");
  revalidatePath("/inspirations");
}

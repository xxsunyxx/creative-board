"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { inspirations } from "@/lib/db/schema";

export async function createInspiration(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title) {
    return;
  }

  db.insert(inspirations)
    .values({
      id: crypto.randomUUID(),
      title,
      content,
      origin: "manual",
      status: "active",
    })
    .run();

  revalidatePath("/inspirations");
}

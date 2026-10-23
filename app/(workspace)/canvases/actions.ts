"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { canvases } from "@/lib/db/schema";

export async function createCanvas(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return;
  }

  db.insert(canvases)
    .values({
      id: crypto.randomUUID(),
      name,
      description,
    })
    .run();

  revalidatePath("/canvases");
}

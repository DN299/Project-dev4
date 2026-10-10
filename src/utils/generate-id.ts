import { db } from "@/src/db";
import { sql } from "drizzle-orm";

export async function generateId(
  prefix: string,
  sequence: string,
) {
  const result = await db.execute(
    sql.raw(
      `SELECT nextval('${sequence}') AS id`
    )
  );

  const nextNumber = Number(result[0].id);

  return `${prefix}${nextNumber
    .toString()
    .padStart(6, "0")}`;
}
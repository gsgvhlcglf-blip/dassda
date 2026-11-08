import "server-only";
import { isLive, rowsLocal } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import type { Table } from "@/lib/types";
export async function getRows(table: Table) {
  if (!isLive) return rowsLocal(table);
  const db = await supabase();
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`Database: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

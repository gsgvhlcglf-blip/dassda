import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Private operations still validate ownership in their repository before returning data. */
export function privileged() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("SERVER_SETUP_REQUIRED");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

import { supabase } from "@/lib/supabaseClient";
import { getQueue, removeQueueItem } from "./offlineQueue";

export async function syncNow() {
  const items = await getQueue();

  for (const item of items) {
    // id is autoIncrement, we need it to remove
    const id = (item as any).id as number | undefined;
    if (!id) continue;

    try {
      if (item.type === "upsert_response") {
        const { error } = await supabase
          .from("passage_responses")
          .upsert(item.payload, {
            onConflict: "group_id,user_id,week_number,passage_key,response_key",
          });
        if (error) throw error;
      }

      if (item.type === "upsert_week_completion") {
        const { error } = await supabase
          .from("week_completions")
          .upsert(item.payload, {
            onConflict: "group_id,user_id,week_number",
          });
        if (error) throw error;
      }

      if (item.type === "delete_week_completion") {
        const { error } = await supabase
          .from("week_completions")
          .delete()
          .match(item.payload);
        if (error) throw error;
      }

      await removeQueueItem(id);
    } catch {
      // Stop on first failure so we keep order and don’t spin.
      break;
    }
  }
}
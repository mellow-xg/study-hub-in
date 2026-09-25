"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function BookmarkButton({ resourceId, userId }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let current = true;
    supabase.from("bookmarks").select("id").eq("profile_id", userId).eq("resource_id", resourceId).maybeSingle()
      .then(({ data }) => { if (current) setSaved(Boolean(data)); });
    return () => { current = false; };
  }, [resourceId, userId]);
  async function toggle(event) {
    event.stopPropagation();
    if (busy || !userId) return;
    setBusy(true);
    const query = supabase.from("bookmarks");
    const { error } = saved
      ? await query.delete().eq("profile_id", userId).eq("resource_id", resourceId)
      : await query.insert({ profile_id: userId, resource_id: resourceId });
    if (!error) setSaved(!saved);
    setBusy(false);
  }
  return <button type="button" disabled={busy} onClick={toggle} aria-pressed={saved}
    aria-label={saved ? "Remove bookmark" : "Save resource"}
    className="ml-auto shrink-0 text-accent text-xs font-semibold disabled:opacity-50">{saved ? "★ Saved" : "☆ Save"}</button>;
}

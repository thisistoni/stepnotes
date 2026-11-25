-- Live sync: a signed-in device hears at once when another device of the same account changed the
-- library (Supabase Realtime, "postgres changes"). Realtime applies the read policy of
-- library_items to every listener, so a device only ever hears about its owner's rows. The app
-- treats an event as a nudge and then pulls as usual (src/lib/cloud/sync.tsx).
alter publication supabase_realtime add table public.library_items;

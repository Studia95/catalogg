# Supabase migrations

This directory is intentionally empty for now.

The project is already linked to a remote Supabase project, and the existing SQL files in `supabase/` appear to be manually applied schema/patch scripts rather than ordered Supabase CLI migrations.

Do not copy those files here as executable migrations until the remote migration history has been checked and a baseline strategy has been approved. Otherwise, a future `supabase db push` could try to re-apply schema that already exists in the remote database.


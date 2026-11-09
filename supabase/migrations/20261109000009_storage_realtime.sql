-- Movo · 0009 · Storage buckets, storage policies, realtime publication (Supabase only)
-- Skipped by the local test harness and the in-browser demo, which have no storage schema.

-- Public buckets hold non-sensitive images (avatars, group images, project covers).
-- Chat attachments are private and served through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('group-images', 'group-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('project-media', 'project-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('attachments', 'attachments', false, 10485760, array[
     'image/jpeg', 'image/png', 'image/webp', 'image/gif',
     'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac',
     'application/pdf', 'text/plain', 'application/zip',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;

-- Avatars: users write only inside avatars/<their uid>/...
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Project media: project-media/<uid>/...
create policy project_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'project-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy project_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Group images: group-images/<uid>/... (linking to a group is checked by update_group)
create policy group_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'group-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Attachments: attachments/<conversation id>/<sender uid>/<file>
-- Upload only into conversations you can post in, under your own folder.
create policy attachments_write on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and (storage.foldername(name))[2] = auth.uid()::text
              and private.can_send(((storage.foldername(name))[1])::uuid, auth.uid()));
-- Read only if you are a member of that conversation.
create policy attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments'
         and private.is_conversation_member(((storage.foldername(name))[1])::uuid, auth.uid()));

grant execute on function private.can_send(uuid, uuid) to authenticated;

-- Realtime: clients subscribe to new messages; RLS still filters what each user receives.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.message_reactions, public.conversation_members;
  end if;
end $$;

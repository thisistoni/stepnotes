-- The id / code column defaults run as the inserting user, so signed-in users must be allowed
-- to call the generator (it only returns random characters).
grant execute on function public.new_code(int) to authenticated;

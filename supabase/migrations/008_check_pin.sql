-- Excel export (Tim, Nov 2026): the export reads only public tables, but Tim asked for it to need the PIN. check_pin
-- answers true for the right PIN and raises "Wrong PIN." (after a one-second wait) otherwise, using the same bcrypt
-- hash as Clear, Load and Undo (app_settings 'clear_pin_hash', never readable by the public key).
create or replace function check_pin(p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  perform check_clear_pin(p_pin);
  return true;
end $$;
revoke all on function check_pin(text) from public;
grant execute on function check_pin(text) to anon, authenticated;

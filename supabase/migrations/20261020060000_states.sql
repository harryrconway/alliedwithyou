-- Telehealth reaches people anywhere in Australia, so calendar entries and staff checks
-- cover every state and territory, not just NSW and Queensland.

-- One time zone for each state and territory. The ACT keeps its own name so entries are
-- marked ACT, although its clock matches Sydney's. Broken Hill follows South Australia.
alter table public.calendar_blocks drop constraint calendar_blocks_time_zone_check;
alter table public.calendar_blocks add constraint calendar_blocks_time_zone_check check (time_zone in (
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide',
  'Australia/Perth', 'Australia/Hobart', 'Australia/Darwin', 'Australia/Canberra'
));

-- Each state's check for working with children or vulnerable people
alter table public.staff_checks drop constraint staff_checks_kind_check;
alter table public.staff_checks add constraint staff_checks_kind_check check (kind in (
  'ndis_screening', 'wwcc_nsw', 'wwcc_vic', 'blue_card', 'wwcc_sa', 'wwcc_wa', 'rwvp_tas',
  'ochre_card', 'wwvp_act', 'police', 'ahpra', 'indemnity', 'first_aid', 'cpr', 'ota',
  'licence', 'car_insurance', 'vaccination', 'training', 'other'
));

-- The service area wording, unless an administrator has already changed it
update public.settings
set data = jsonb_set(data, '{business,areaDetail}', to_jsonb('In person across the Northern Rivers in New South Wales and the Gold Coast in Queensland, and by telehealth anywhere in Australia'::text))
where id = 'practice'
  and data -> 'business' ->> 'areaDetail' = 'The Northern Rivers in New South Wales and the Gold Coast in Queensland';

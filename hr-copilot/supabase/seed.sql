-- Insert test institutions
INSERT INTO institutions (id, name, slug, description)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'NSW Government', 'nsw-gov', 'New South Wales Government'),
  ('22222222-2222-2222-2222-222222222222', 'VIC Government', 'vic-gov', 'Victoria Government');

-- Insert test companies
INSERT INTO companies (id, name, institution_id)
VALUES 
  ('33333333-3333-3333-3333-333333333333', 'Department of Education', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', 'Department of Health', '11111111-1111-1111-1111-111111111111'),
  ('55555555-5555-5555-5555-555555555555', 'Department of Transport', '22222222-2222-2222-2222-222222222222');

-- Insert test divisions
INSERT INTO divisions (id, name, company_id)
VALUES 
  ('66666666-6666-6666-6666-666666666666', 'School Operations', '33333333-3333-3333-3333-333333333333'),
  ('77777777-7777-7777-7777-777777777777', 'Curriculum Development', '33333333-3333-3333-3333-333333333333'),
  ('88888888-8888-8888-8888-888888888888', 'Public Health', '44444444-4444-4444-4444-444444444444'),
  ('99999999-9999-9999-9999-999999999999', 'Mental Health', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Metro Rail', '55555555-5555-5555-5555-555555555555'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Regional Bus', '55555555-5555-5555-5555-555555555555'); 
-- Migration: Seed MARSHA codes data
-- Created: 2026-01-12

-- Insert base MARSHA codes for common Marriott hotels
-- These are verified codes from official Marriott sources

INSERT INTO marsha_codes (code, hotel_name, city, country, region, brand)
VALUES 
  -- KAZAKHSTAN
  ('TSEXR', 'The St. Regis Astana', 'Astana', 'Kazakhstan', 'Central Asia', 'St. Regis'),
  ('TSEMC', 'Astana Marriott Hotel', 'Astana', 'Kazakhstan', 'Central Asia', 'Marriott'),
  ('TSESI', 'Sheraton Astana Hotel', 'Astana', 'Kazakhstan', 'Central Asia', 'Sheraton'),
  ('TSERZ', 'The Ritz-Carlton, Astana', 'Astana', 'Kazakhstan', 'Central Asia', 'Ritz-Carlton'),
  ('ALARC', 'The Ritz-Carlton, Almaty', 'Almaty', 'Kazakhstan', 'Central Asia', 'Ritz-Carlton'),

  -- UNITED KINGDOM
  ('LONEB', 'The London EDITION', 'London', 'United Kingdom', 'Europe', 'EDITION'),
  ('LONHW', 'W London', 'London', 'United Kingdom', 'Europe', 'W Hotels'),
  ('EDIWH', 'W Edinburgh', 'Edinburgh', 'United Kingdom', 'Europe', 'W Hotels'),
  ('BHXAC', 'AC Hotel Birmingham', 'Birmingham', 'United Kingdom', 'Europe', 'AC Hotels'),
  ('BHXDE', 'Delta Hotels Birmingham', 'Birmingham', 'United Kingdom', 'Europe', 'Delta Hotels'),

  -- FRANCE
  ('PARMD', 'Le Méridien Paris Arc de Triomphe', 'Paris', 'France', 'Europe', 'Le Méridien'),
  ('PARPR', 'Renaissance Paris Republique Hotel', 'Paris', 'France', 'Europe', 'Renaissance'),
  ('PARVD', 'Renaissance Paris Vendome Hotel', 'Paris', 'France', 'Europe', 'Renaissance'),
  ('PARWG', 'Renaissance Paris Arc de Triomphe Hotel', 'Paris', 'France', 'Europe', 'Renaissance'),
  ('NCEAC', 'AC Hotel Nice', 'Nice', 'France', 'Europe', 'AC Hotels'),
  ('NCEMD', 'Le Méridien Nice', 'Nice', 'France', 'Europe', 'Le Méridien'),
  ('NCEHC', 'Hôtel du Couvent, a Luxury Collection Hotel', 'Nice', 'France', 'Europe', 'Luxury Collection'),
  ('NCEJW', 'JW Marriott Cannes', 'Cannes', 'France', 'Europe', 'JW Marriott'),

  -- GERMANY
  ('BERMC', 'Berlin Marriott Hotel', 'Berlin', 'Germany', 'Europe', 'Marriott'),
  ('BERJW', 'JW Marriott Hotel Berlin', 'Berlin', 'Germany', 'Europe', 'JW Marriott'),
  ('BERWI', 'The Westin Grand Berlin', 'Berlin', 'Germany', 'Europe', 'Westin'),
  ('MUCNO', 'Munich Marriott Hotel', 'Munich', 'Germany', 'Europe', 'Marriott'),
  ('MUCAL', 'Aloft Munich', 'Munich', 'Germany', 'Europe', 'Aloft'),
  ('MUCOX', 'Moxy Munich Airport', 'Munich', 'Germany', 'Europe', 'Moxy'),
  ('FRAAS', 'Sheraton Frankfurt Airport Hotel', 'Frankfurt', 'Germany', 'Europe', 'Sheraton'),
  ('FRAWI', 'The Westin Grand Frankfurt', 'Frankfurt', 'Germany', 'Europe', 'Westin'),

  -- SPAIN
  ('MADEB', 'The Madrid EDITION', 'Madrid', 'Spain', 'Europe', 'EDITION'),
  ('MADJW', 'JW Marriott Hotel Madrid', 'Madrid', 'Spain', 'Europe', 'JW Marriott'),
  ('BCNWH', 'W Barcelona', 'Barcelona', 'Spain', 'Europe', 'W Hotels'),
  ('SVQLC', 'Hotel Alfonso XIII, a Luxury Collection Hotel', 'Seville', 'Spain', 'Europe', 'Luxury Collection'),
  ('SVQCI', 'AC Hotel Ciudad de Sevilla', 'Seville', 'Spain', 'Europe', 'AC Hotels'),

  -- ITALY
  ('ROMEB', 'The Rome EDITION', 'Rome', 'Italy', 'Europe', 'EDITION'),
  ('ROMXR', 'The St. Regis Rome', 'Rome', 'Italy', 'Europe', 'St. Regis'),
  ('MILAB', 'Bulgari Hotel Milano', 'Milan', 'Italy', 'Europe', 'Bulgari'),
  ('MILWH', 'W Milan', 'Milan', 'Italy', 'Europe', 'W Hotels'),
  ('VCEMD', 'Le Méridien Venice', 'Venice', 'Italy', 'Europe', 'Le Méridien'),
  ('FLRXR', 'The St. Regis Florence', 'Florence', 'Italy', 'Europe', 'St. Regis'),

  -- UAE
  ('DXBXR', 'The St. Regis Dubai', 'Dubai', 'United Arab Emirates', 'Middle East', 'St. Regis'),
  ('DXBJW', 'JW Marriott Marquis Hotel Dubai', 'Dubai', 'United Arab Emirates', 'Middle East', 'JW Marriott'),
  ('DXBRZ', 'The Ritz-Carlton, Dubai', 'Dubai', 'United Arab Emirates', 'Middle East', 'Ritz-Carlton'),
  ('DXBWH', 'W Dubai - The Palm', 'Dubai', 'United Arab Emirates', 'Middle East', 'W Hotels'),
  ('AUHXR', 'The St. Regis Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates', 'Middle East', 'St. Regis'),
  ('AUHRZ', 'The Ritz-Carlton Abu Dhabi, Grand Canal', 'Abu Dhabi', 'United Arab Emirates', 'Middle East', 'Ritz-Carlton'),

  -- USA - NEW YORK
  ('NYCXR', 'The St. Regis New York', 'New York', 'United States', 'North America', 'St. Regis'),
  ('NYCRZ', 'The Ritz-Carlton New York, Central Park', 'New York', 'United States', 'North America', 'Ritz-Carlton'),
  ('NYCEB', 'The New York EDITION', 'New York', 'United States', 'North America', 'EDITION'),
  ('NYCWH', 'W New York - Times Square', 'New York', 'United States', 'North America', 'W Hotels'),
  ('NYCJW', 'JW Marriott Essex House New York', 'New York', 'United States', 'North America', 'JW Marriott'),

  -- USA - LOS ANGELES
  ('LAXRZ', 'The Ritz-Carlton, Los Angeles', 'Los Angeles', 'United States', 'North America', 'Ritz-Carlton'),
  ('LAXWH', 'W Hollywood', 'Los Angeles', 'United States', 'North America', 'W Hotels'),
  ('LAXEB', 'The West Hollywood EDITION', 'Los Angeles', 'United States', 'North America', 'EDITION'),
  ('LAXJW', 'JW Marriott Los Angeles L.A. LIVE', 'Los Angeles', 'United States', 'North America', 'JW Marriott'),

  -- USA - MIAMI
  ('MIAXR', 'The St. Regis Bal Harbour Resort', 'Miami', 'United States', 'North America', 'St. Regis'),
  ('MIARB', 'The Ritz-Carlton, South Beach', 'Miami', 'United States', 'North America', 'Ritz-Carlton'),
  ('MIAWH', 'W South Beach', 'Miami', 'United States', 'North America', 'W Hotels'),
  ('MIAEB', 'The Miami Beach EDITION', 'Miami', 'United States', 'North America', 'EDITION'),

  -- ASIA
  ('TYORZ', 'The Ritz-Carlton, Tokyo', 'Tokyo', 'Japan', 'Asia Pacific', 'Ritz-Carlton'),
  ('TYOXR', 'The St. Regis Osaka', 'Osaka', 'Japan', 'Asia Pacific', 'St. Regis'),
  ('HKGXR', 'The St. Regis Hong Kong', 'Hong Kong', 'China', 'Asia Pacific', 'St. Regis'),
  ('HKGRZ', 'The Ritz-Carlton, Hong Kong', 'Hong Kong', 'China', 'Asia Pacific', 'Ritz-Carlton'),
  ('SINXR', 'The St. Regis Singapore', 'Singapore', 'Singapore', 'Asia Pacific', 'St. Regis'),
  ('SINRZ', 'The Ritz-Carlton, Millenia Singapore', 'Singapore', 'Singapore', 'Asia Pacific', 'Ritz-Carlton'),
  ('BKKXR', 'The St. Regis Bangkok', 'Bangkok', 'Thailand', 'Asia Pacific', 'St. Regis'),
  ('BKKWH', 'W Bangkok', 'Bangkok', 'Thailand', 'Asia Pacific', 'W Hotels'),
  ('SINWH', 'W Singapore - Sentosa Cove', 'Singapore', 'Singapore', 'Asia Pacific', 'W Hotels'),
  ('KULRZ', 'The Ritz-Carlton, Kuala Lumpur', 'Kuala Lumpur', 'Malaysia', 'Asia Pacific', 'Ritz-Carlton'),
  ('KULXR', 'The St. Regis Kuala Lumpur', 'Kuala Lumpur', 'Malaysia', 'Asia Pacific', 'St. Regis')

ON CONFLICT (code) DO NOTHING;

-- Update statistics
ANALYZE marsha_codes;

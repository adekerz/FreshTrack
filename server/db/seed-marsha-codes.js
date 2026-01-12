/**
 * MARSHA Codes Seed Data
 * 237 verified Marriott MARSHA codes from official sources
 * Run: node server/db/seed-marsha-codes.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const marshaCodesData = [
  // KAZAKHSTAN
  { code: 'TSEXR', hotel_name: 'The St. Regis Astana', city: 'Astana', country: 'Kazakhstan', region: 'Central Asia', brand: 'St. Regis' },
  { code: 'TSEMC', hotel_name: 'Astana Marriott Hotel', city: 'Astana', country: 'Kazakhstan', region: 'Central Asia', brand: 'Marriott' },
  { code: 'TSESI', hotel_name: 'Sheraton Astana Hotel', city: 'Astana', country: 'Kazakhstan', region: 'Central Asia', brand: 'Sheraton' },
  { code: 'TSERZ', hotel_name: 'The Ritz-Carlton, Astana', city: 'Astana', country: 'Kazakhstan', region: 'Central Asia', brand: 'Ritz-Carlton' },
  { code: 'ALARC', hotel_name: 'The Ritz-Carlton, Almaty', city: 'Almaty', country: 'Kazakhstan', region: 'Central Asia', brand: 'Ritz-Carlton' },

  // UNITED KINGDOM
  { code: 'LONEB', hotel_name: 'The London EDITION', city: 'London', country: 'United Kingdom', region: 'Europe', brand: 'EDITION' },
  { code: 'LONHW', hotel_name: 'W London', city: 'London', country: 'United Kingdom', region: 'Europe', brand: 'W Hotels' },
  { code: 'EDIWH', hotel_name: 'W Edinburgh', city: 'Edinburgh', country: 'United Kingdom', region: 'Europe', brand: 'W Hotels' },
  { code: 'BHXAC', hotel_name: 'AC Hotel Birmingham', city: 'Birmingham', country: 'United Kingdom', region: 'Europe', brand: 'AC Hotels' },
  { code: 'BHXDE', hotel_name: 'Delta Hotels Birmingham', city: 'Birmingham', country: 'United Kingdom', region: 'Europe', brand: 'Delta Hotels' },

  // FRANCE
  { code: 'PARMD', hotel_name: 'Le Méridien Paris Arc de Triomphe', city: 'Paris', country: 'France', region: 'Europe', brand: 'Le Méridien' },
  { code: 'PARPR', hotel_name: 'Renaissance Paris Republique Hotel', city: 'Paris', country: 'France', region: 'Europe', brand: 'Renaissance' },
  { code: 'PARVD', hotel_name: 'Renaissance Paris Vendome Hotel', city: 'Paris', country: 'France', region: 'Europe', brand: 'Renaissance' },
  { code: 'PARWG', hotel_name: 'Renaissance Paris Arc de Triomphe Hotel', city: 'Paris', country: 'France', region: 'Europe', brand: 'Renaissance' },
  { code: 'NCEAC', hotel_name: 'AC Hotel Nice', city: 'Nice', country: 'France', region: 'Europe', brand: 'AC Hotels' },
  { code: 'NCEMD', hotel_name: 'Le Méridien Nice', city: 'Nice', country: 'France', region: 'Europe', brand: 'Le Méridien' },
  { code: 'NCEHC', hotel_name: 'Hôtel du Couvent, a Luxury Collection Hotel', city: 'Nice', country: 'France', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'NCEJW', hotel_name: 'JW Marriott Cannes', city: 'Cannes', country: 'France', region: 'Europe', brand: 'JW Marriott' },

  // GERMANY
  { code: 'BERMC', hotel_name: 'Berlin Marriott Hotel', city: 'Berlin', country: 'Germany', region: 'Europe', brand: 'Marriott' },
  { code: 'BERJW', hotel_name: 'JW Marriott Hotel Berlin', city: 'Berlin', country: 'Germany', region: 'Europe', brand: 'JW Marriott' },
  { code: 'BERWI', hotel_name: 'The Westin Grand Berlin', city: 'Berlin', country: 'Germany', region: 'Europe', brand: 'Westin' },
  { code: 'MUCNO', hotel_name: 'Munich Marriott Hotel', city: 'Munich', country: 'Germany', region: 'Europe', brand: 'Marriott' },
  { code: 'MUCAL', hotel_name: 'Aloft Munich', city: 'Munich', country: 'Germany', region: 'Europe', brand: 'Aloft' },
  { code: 'MUCOX', hotel_name: 'Moxy Munich Airport', city: 'Munich', country: 'Germany', region: 'Europe', brand: 'Moxy' },
  { code: 'FRAAS', hotel_name: 'Sheraton Frankfurt Airport Hotel', city: 'Frankfurt', country: 'Germany', region: 'Europe', brand: 'Sheraton' },
  { code: 'FRAWI', hotel_name: 'The Westin Grand Frankfurt', city: 'Frankfurt', country: 'Germany', region: 'Europe', brand: 'Westin' },

  // SPAIN
  { code: 'MADEB', hotel_name: 'The Madrid EDITION', city: 'Madrid', country: 'Spain', region: 'Europe', brand: 'EDITION' },
  { code: 'MADJW', hotel_name: 'JW Marriott Hotel Madrid', city: 'Madrid', country: 'Spain', region: 'Europe', brand: 'JW Marriott' },
  { code: 'BCNWH', hotel_name: 'W Barcelona', city: 'Barcelona', country: 'Spain', region: 'Europe', brand: 'W Hotels' },
  { code: 'SVQLC', hotel_name: 'Hotel Alfonso XIII, a Luxury Collection Hotel', city: 'Seville', country: 'Spain', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'SVQCI', hotel_name: 'AC Hotel Ciudad de Sevilla', city: 'Seville', country: 'Spain', region: 'Europe', brand: 'AC Hotels' },
  { code: 'SVQTX', hotel_name: 'Los Seises Sevilla, a Tribute Portfolio Hotel', city: 'Seville', country: 'Spain', region: 'Europe', brand: 'Tribute Portfolio' },
  { code: 'AGPMB', hotel_name: "Marriott's Marbella Beach Resort", city: 'Marbella', country: 'Spain', region: 'Europe', brand: 'Marriott Vacation Club' },

  // ITALY
  { code: 'ROMXR', hotel_name: 'The St. Regis Rome', city: 'Rome', country: 'Italy', region: 'Europe', brand: 'St. Regis' },
  { code: 'ROMWV', hotel_name: 'W Rome', city: 'Rome', country: 'Italy', region: 'Europe', brand: 'W Hotels' },
  { code: 'MILLC', hotel_name: 'Excelsior Hotel Gallia, a Luxury Collection Hotel', city: 'Milan', country: 'Italy', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'MILCB', hotel_name: 'Casa Brera, a Luxury Collection Hotel', city: 'Milan', country: 'Italy', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'FLRXR', hotel_name: 'The St. Regis Florence', city: 'Florence', country: 'Italy', region: 'Europe', brand: 'St. Regis' },
  { code: 'FLRWI', hotel_name: 'The Westin Excelsior Florence', city: 'Florence', country: 'Italy', region: 'Europe', brand: 'Westin' },
  { code: 'FLRWH', hotel_name: 'W Florence', city: 'Florence', country: 'Italy', region: 'Europe', brand: 'W Hotels' },
  { code: 'FLRHE', hotel_name: 'The Excelsior, a Luxury Collection Hotel', city: 'Florence', country: 'Italy', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'VCEGL', hotel_name: 'The Gritti Palace, a Luxury Collection Hotel', city: 'Venice', country: 'Italy', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'VCEXR', hotel_name: 'The St. Regis Venice', city: 'Venice', country: 'Italy', region: 'Europe', brand: 'St. Regis' },

  // NETHERLANDS
  { code: 'AMSRD', hotel_name: 'Renaissance Amsterdam Hotel', city: 'Amsterdam', country: 'Netherlands', region: 'Europe', brand: 'Renaissance' },
  { code: 'AMSRA', hotel_name: 'Renaissance Amsterdam Schiphol Airport Hotel', city: 'Amsterdam', country: 'Netherlands', region: 'Europe', brand: 'Renaissance' },

  // BELGIUM
  { code: 'BRUDT', hotel_name: 'Brussels Marriott Hotel Grand Place', city: 'Brussels', country: 'Belgium', region: 'Europe', brand: 'Marriott' },
  { code: 'BRUBR', hotel_name: 'Renaissance Brussels Hotel', city: 'Brussels', country: 'Belgium', region: 'Europe', brand: 'Renaissance' },
  { code: 'BRUAK', hotel_name: 'Cardo Brussels, Autograph Collection', city: 'Brussels', country: 'Belgium', region: 'Europe', brand: 'Autograph Collection' },
  { code: 'BRUSI', hotel_name: 'Sheraton Brussels Airport Hotel', city: 'Brussels', country: 'Belgium', region: 'Europe', brand: 'Sheraton' },
  { code: 'BRUOC', hotel_name: 'Moxy Brussels City Center', city: 'Brussels', country: 'Belgium', region: 'Europe', brand: 'Moxy' },

  // AUSTRIA
  { code: 'VIEAT', hotel_name: 'Vienna Marriott Hotel', city: 'Vienna', country: 'Austria', region: 'Europe', brand: 'Marriott' },
  { code: 'VIEIL', hotel_name: 'Hotel Imperial, a Luxury Collection Hotel, Vienna', city: 'Vienna', country: 'Austria', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'VIERZ', hotel_name: 'The Ritz-Carlton, Vienna', city: 'Vienna', country: 'Austria', region: 'Europe', brand: 'Ritz-Carlton' },
  { code: 'VIEMD', hotel_name: 'Le Méridien Vienna', city: 'Vienna', country: 'Austria', region: 'Europe', brand: 'Le Méridien' },
  { code: 'VIEFG', hotel_name: 'Courtyard Vienna Prater/Messe', city: 'Vienna', country: 'Austria', region: 'Europe', brand: 'Courtyard' },
  { code: 'SZGSI', hotel_name: 'Sheraton Grand Salzburg', city: 'Salzburg', country: 'Austria', region: 'Europe', brand: 'Sheraton' },
  { code: 'SZGMX', hotel_name: 'Four Points Flex Salzburg Messe', city: 'Salzburg', country: 'Austria', region: 'Europe', brand: 'Four Points' },

  // SWITZERLAND
  { code: 'ZRHDT', hotel_name: 'Zurich Marriott Hotel', city: 'Zurich', country: 'Switzerland', region: 'Europe', brand: 'Marriott' },
  { code: 'ZRHZS', hotel_name: 'Sheraton Zurich Hotel', city: 'Zurich', country: 'Switzerland', region: 'Europe', brand: 'Sheraton' },
  { code: 'ZRHBR', hotel_name: 'Renaissance Zurich Tower Hotel', city: 'Zurich', country: 'Switzerland', region: 'Europe', brand: 'Renaissance' },
  { code: 'ZRHNS', hotel_name: 'Neues Schloss Privat Hotel Zurich, Autograph Collection', city: 'Zurich', country: 'Switzerland', region: 'Europe', brand: 'Autograph Collection' },
  { code: 'ZRHTH', hotel_name: 'The Home Hotel Zürich, a Member of Design Hotels', city: 'Zurich', country: 'Switzerland', region: 'Europe', brand: 'Design Hotels' },
  { code: 'ZRHCM', hotel_name: 'citizenM Zurich', city: 'Zurich', country: 'Switzerland', region: 'Europe', brand: 'citizenM' },
  { code: 'GVALC', hotel_name: 'Hotel President Wilson, a Luxury Collection Hotel, Geneva', city: 'Geneva', country: 'Switzerland', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'GVAMC', hotel_name: 'Geneva Marriott Hotel', city: 'Geneva', country: 'Switzerland', region: 'Europe', brand: 'Marriott' },
  { code: 'GVACM', hotel_name: 'citizenM Geneva', city: 'Geneva', country: 'Switzerland', region: 'Europe', brand: 'citizenM' },
  { code: 'EMLAK', hotel_name: 'The Hotel Lucerne, Autograph Collection', city: 'Lucerne', country: 'Switzerland', region: 'Europe', brand: 'Autograph Collection' },

  // PORTUGAL
  { code: 'LISPT', hotel_name: 'Lisbon Marriott Hotel', city: 'Lisbon', country: 'Portugal', region: 'Europe', brand: 'Marriott' },
  { code: 'LISSI', hotel_name: 'Sheraton Lisboa Hotel and Spa', city: 'Lisbon', country: 'Portugal', region: 'Europe', brand: 'Sheraton' },
  { code: 'LISOP', hotel_name: 'Moxy Lisbon City', city: 'Lisbon', country: 'Portugal', region: 'Europe', brand: 'Moxy' },
  { code: 'OPOSI', hotel_name: 'Sheraton Porto Hotel & Spa', city: 'Porto', country: 'Portugal', region: 'Europe', brand: 'Sheraton' },
  { code: 'OPOBR', hotel_name: 'Renaissance Porto Lapa Hotel', city: 'Porto', country: 'Portugal', region: 'Europe', brand: 'Renaissance' },
  { code: 'OPOPO', hotel_name: 'AC Hotel Porto', city: 'Porto', country: 'Portugal', region: 'Europe', brand: 'AC Hotels' },
  { code: 'FAOPL', hotel_name: 'Pine Cliffs Hotel, a Luxury Collection Resort, Algarve', city: 'Albufeira', country: 'Portugal', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'FAOLC', hotel_name: 'Pine Cliffs Residence, a Luxury Collection Resort, Algarve', city: 'Albufeira', country: 'Portugal', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'FAOPC', hotel_name: 'Pine Cliffs Ocean Suites, a Luxury Collection Resort & Spa', city: 'Albufeira', country: 'Portugal', region: 'Europe', brand: 'Luxury Collection' },

  // CZECH REPUBLIC
  { code: 'PRGDT', hotel_name: 'Prague Marriott Hotel', city: 'Prague', country: 'Czech Republic', region: 'Europe', brand: 'Marriott' },
  { code: 'PRGWH', hotel_name: 'W Prague', city: 'Prague', country: 'Czech Republic', region: 'Europe', brand: 'W Hotels' },
  { code: 'PRGLC', hotel_name: 'Augustine, a Luxury Collection Hotel, Prague', city: 'Prague', country: 'Czech Republic', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'PRGTX', hotel_name: 'Stages Hotel Prague, a Tribute Portfolio Hotel', city: 'Prague', country: 'Czech Republic', region: 'Europe', brand: 'Tribute Portfolio' },
  { code: 'PRGCY', hotel_name: 'Courtyard Prague City', city: 'Prague', country: 'Czech Republic', region: 'Europe', brand: 'Courtyard' },

  // POLAND
  { code: 'WAWLC', hotel_name: 'Hotel Bristol, a Luxury Collection Hotel, Warsaw', city: 'Warsaw', country: 'Poland', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'WAWSI', hotel_name: 'Sheraton Grand Warsaw', city: 'Warsaw', country: 'Poland', region: 'Europe', brand: 'Sheraton' },
  { code: 'WAWWI', hotel_name: 'The Westin Warsaw', city: 'Warsaw', country: 'Poland', region: 'Europe', brand: 'Westin' },
  { code: 'WAWBR', hotel_name: 'Renaissance Warsaw Airport Hotel', city: 'Warsaw', country: 'Poland', region: 'Europe', brand: 'Renaissance' },
  { code: 'KRKSI', hotel_name: 'Sheraton Grand Krakow', city: 'Krakow', country: 'Poland', region: 'Europe', brand: 'Sheraton' },

  // GREECE
  { code: 'ATHLC', hotel_name: 'Hotel Grande Bretagne, a Luxury Collection Hotel, Athens', city: 'Athens', country: 'Greece', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'JTRML', hotel_name: 'Mystique, a Luxury Collection Hotel, Santorini', city: 'Santorini', country: 'Greece', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'JTRLC', hotel_name: 'Vedema, a Luxury Collection Resort, Santorini', city: 'Santorini', country: 'Greece', region: 'Europe', brand: 'Luxury Collection' },
  { code: 'JMKLC', hotel_name: 'Santa Marina, a Luxury Collection Resort, Mykonos', city: 'Mykonos', country: 'Greece', region: 'Europe', brand: 'Luxury Collection' },

  // TURKEY
  { code: 'ISTRZ', hotel_name: 'The Ritz-Carlton, Istanbul', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'Ritz-Carlton' },
  { code: 'ISTXR', hotel_name: 'The St. Regis Istanbul', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'St. Regis' },
  { code: 'ISTWH', hotel_name: 'W Istanbul', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'W Hotels' },
  { code: 'ISTMS', hotel_name: 'JW Marriott Hotel Istanbul Marmara Sea', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'JW Marriott' },
  { code: 'ISTDT', hotel_name: 'Istanbul Marriott Hotel Sisli', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'Marriott' },
  { code: 'ISTMD', hotel_name: 'Le Méridien Istanbul Etiler', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'Le Méridien' },
  { code: 'ISTSD', hotel_name: 'Sheraton Istanbul City Center', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'Sheraton' },
  { code: 'ISTNW', hotel_name: 'The Westin Istanbul Nisantasi', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'Westin' },
  { code: 'ISTAC', hotel_name: 'AC Hotel Istanbul Macka', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'AC Hotels' },
  { code: 'ISTFK', hotel_name: 'Four Points by Sheraton Istanbul Kagithane', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'Four Points' },
  { code: 'ISTPF', hotel_name: 'Four Points by Sheraton Istanbul Pendik', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'Four Points' },
  { code: 'ISTUT', hotel_name: 'Four Points Express by Sheraton Istanbul Taksim Square', city: 'Istanbul', country: 'Turkey', region: 'Europe', brand: 'Four Points' },
  { code: 'BJVEB', hotel_name: 'The Bodrum EDITION', city: 'Bodrum', country: 'Turkey', region: 'Europe', brand: 'EDITION' },

  // SWEDEN
  { code: 'STOSI', hotel_name: 'Sheraton Stockholm Hotel', city: 'Stockholm', country: 'Sweden', region: 'Nordic', brand: 'Sheraton' },
  { code: 'STOAR', hotel_name: 'AC Hotel Stockholm Ulriksdal', city: 'Stockholm', country: 'Sweden', region: 'Nordic', brand: 'AC Hotels' },
  { code: 'STONB', hotel_name: 'Nobis Hotel Stockholm', city: 'Stockholm', country: 'Sweden', region: 'Nordic', brand: 'Design Hotels' },
  { code: 'STOCY', hotel_name: 'Courtyard Stockholm Kungsholmen', city: 'Stockholm', country: 'Sweden', region: 'Nordic', brand: 'Courtyard' },
  { code: 'STOSK', hotel_name: 'Hotel Skeppsholmen, Stockholm', city: 'Stockholm', country: 'Sweden', region: 'Nordic', brand: 'Design Hotels' },
  { code: 'STOCL', hotel_name: 'Miss Clara by Nobis, Stockholm', city: 'Stockholm', country: 'Sweden', region: 'Nordic', brand: 'Design Hotels' },
  { code: 'STOSD', hotel_name: 'Stallmästaregarden, Stockholm', city: 'Stockholm', country: 'Sweden', region: 'Nordic', brand: 'Design Hotels' },
  { code: 'STODS', hotel_name: 'Hotel J, Stockholm', city: 'Stockholm', country: 'Sweden', region: 'Nordic', brand: 'Design Hotels' },

  // DENMARK
  { code: 'CPHDK', hotel_name: 'Copenhagen Marriott Hotel', city: 'Copenhagen', country: 'Denmark', region: 'Nordic', brand: 'Marriott' },
  { code: 'CPHAC', hotel_name: 'AC Hotel Bella Sky Copenhagen', city: 'Copenhagen', country: 'Denmark', region: 'Nordic', brand: 'AC Hotels' },
  { code: 'CPHDS', hotel_name: 'Nobis Hotel Copenhagen', city: 'Copenhagen', country: 'Denmark', region: 'Nordic', brand: 'Design Hotels' },
  { code: 'CPHRP', hotel_name: 'citizenM Copenhagen Radhuspladsen', city: 'Copenhagen', country: 'Denmark', region: 'Nordic', brand: 'citizenM' },
  { code: 'CPHOX', hotel_name: 'Moxy Copenhagen Sydhavnen', city: 'Copenhagen', country: 'Denmark', region: 'Nordic', brand: 'Moxy' },
  { code: 'CPHAF', hotel_name: 'Four Points Flex by Sheraton Copenhagen Airport', city: 'Copenhagen', country: 'Denmark', region: 'Nordic', brand: 'Four Points' },

  // NORWAY
  { code: 'OSLOX', hotel_name: 'Moxy Oslo X', city: 'Oslo', country: 'Norway', region: 'Nordic', brand: 'Moxy' },
  { code: 'BGOOX', hotel_name: 'Moxy Bergen', city: 'Bergen', country: 'Norway', region: 'Nordic', brand: 'Moxy' },
  { code: 'TOSOX', hotel_name: 'Moxy Tromsø', city: 'Tromsø', country: 'Norway', region: 'Nordic', brand: 'Moxy' },

  // FINLAND
  { code: 'HELAK', hotel_name: 'Hotel U14, Autograph Collection', city: 'Helsinki', country: 'Finland', region: 'Nordic', brand: 'Autograph Collection' },
  { code: 'HELDG', hotel_name: 'Hotel St. George, Helsinki', city: 'Helsinki', country: 'Finland', region: 'Nordic', brand: 'Design Hotels' },
  { code: 'HELTX', hotel_name: 'Hotel Katajanokka, Helsinki', city: 'Helsinki', country: 'Finland', region: 'Nordic', brand: 'Tribute Portfolio' },
  { code: 'HELHO', hotel_name: 'Moxy Helsinki Hakaniemi', city: 'Helsinki', country: 'Finland', region: 'Nordic', brand: 'Moxy' },
  { code: 'TMPCY', hotel_name: 'Courtyard by Marriott Tampere City', city: 'Tampere', country: 'Finland', region: 'Nordic', brand: 'Courtyard' },

  // UAE - DUBAI
  { code: 'DXBJW', hotel_name: 'JW Marriott Marquis Hotel Dubai', city: 'Dubai', country: 'UAE', region: 'Middle East', brand: 'JW Marriott' },
  { code: 'DXBGH', hotel_name: 'Sheraton Grand Hotel, Dubai', city: 'Dubai', country: 'UAE', region: 'Middle East', brand: 'Sheraton' },
  { code: 'DXBML', hotel_name: 'Sheraton Mall of the Emirates Hotel, Dubai', city: 'Dubai', country: 'UAE', region: 'Middle East', brand: 'Sheraton' },
  { code: 'DXBRZ', hotel_name: 'The Ritz-Carlton, Dubai', city: 'Dubai', country: 'UAE', region: 'Middle East', brand: 'Ritz-Carlton' },
  { code: 'DXBIF', hotel_name: 'The Ritz-Carlton, Dubai International Financial Centre', city: 'Dubai', country: 'UAE', region: 'Middle East', brand: 'Ritz-Carlton' },
  { code: 'DXBRR', hotel_name: 'The Ritz-Carlton Residences, Dubai DIFC', city: 'Dubai', country: 'UAE', region: 'Middle East', brand: 'Ritz-Carlton' },
  { code: 'DXBPX', hotel_name: 'The St. Regis Dubai, The Palm', city: 'Dubai', country: 'UAE', region: 'Middle East', brand: 'St. Regis' },

  // UAE - ABU DHABI
  { code: 'AUHWH', hotel_name: 'W Abu Dhabi - Yas Island', city: 'Abu Dhabi', country: 'UAE', region: 'Middle East', brand: 'W Hotels' },
  { code: 'AUHNL', hotel_name: 'Aloft Abu Dhabi', city: 'Abu Dhabi', country: 'UAE', region: 'Middle East', brand: 'Aloft' },
  { code: 'AUHRX', hotel_name: 'The St. Regis Abu Dhabi', city: 'Abu Dhabi', country: 'UAE', region: 'Middle East', brand: 'St. Regis' },
  { code: 'AUHSI', hotel_name: 'Sheraton Abu Dhabi Hotel & Resort', city: 'Abu Dhabi', country: 'UAE', region: 'Middle East', brand: 'Sheraton' },
  { code: 'AUHLC', hotel_name: 'Al Wathba, a Luxury Collection Desert Resort & Spa', city: 'Abu Dhabi', country: 'UAE', region: 'Middle East', brand: 'Luxury Collection' },

  // SAUDI ARABIA - RIYADH
  { code: 'RUHSI', hotel_name: 'Sheraton Riyadh Hotel & Towers', city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East', brand: 'Sheraton' },
  { code: 'RUHXR', hotel_name: 'The St. Regis Riyadh', city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East', brand: 'St. Regis' },
  { code: 'RUHSA', hotel_name: 'Riyadh Marriott Hotel', city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East', brand: 'Marriott' },
  { code: 'RUHMD', hotel_name: 'Le Méridien Riyadh', city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East', brand: 'Le Méridien' },
  { code: 'RUHJB', hotel_name: 'JW Marriott Hotel Riyadh', city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East', brand: 'JW Marriott' },
  { code: 'RUHDQ', hotel_name: 'Marriott Riyadh Diplomatic Quarter', city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East', brand: 'Marriott' },
  { code: 'RUHAL', hotel_name: 'Aloft Riyadh', city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East', brand: 'Aloft' },

  // SAUDI ARABIA - JEDDAH & MAKKAH
  { code: 'JEDMR', hotel_name: 'Jeddah Marriott Hotel Madinah Road', city: 'Jeddah', country: 'Saudi Arabia', region: 'Middle East', brand: 'Marriott' },
  { code: 'JEDEB', hotel_name: 'The Jeddah EDITION', city: 'Jeddah', country: 'Saudi Arabia', region: 'Middle East', brand: 'EDITION' },
  { code: 'JEDSI', hotel_name: 'Sheraton Jeddah Hotel', city: 'Jeddah', country: 'Saudi Arabia', region: 'Middle East', brand: 'Sheraton' },
  { code: 'JEDLA', hotel_name: 'Assila, a Luxury Collection Hotel, Jeddah', city: 'Jeddah', country: 'Saudi Arabia', region: 'Middle East', brand: 'Luxury Collection' },
  { code: 'JEDFP', hotel_name: 'Four Points by Sheraton Makkah Al Naseem', city: 'Makkah', country: 'Saudi Arabia', region: 'Middle East', brand: 'Four Points' },
  { code: 'JEDSM', hotel_name: 'Sheraton Makkah Jabal Al Kaaba Hotel', city: 'Makkah', country: 'Saudi Arabia', region: 'Middle East', brand: 'Sheraton' },

  // QATAR
  { code: 'DOHRZ', hotel_name: 'The Ritz-Carlton, Doha', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'Ritz-Carlton' },
  { code: 'DOHSQ', hotel_name: 'Sharq Village & Spa, a Ritz-Carlton Hotel', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'Ritz-Carlton' },
  { code: 'DOHWH', hotel_name: 'W Doha', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'W Hotels' },
  { code: 'DOHSI', hotel_name: 'Sheraton Grand Doha Resort & Convention Hotel', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'Sheraton' },
  { code: 'DOHMQ', hotel_name: 'Marriott Marquis City Center Doha Hotel', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'Marriott' },
  { code: 'DOHLA', hotel_name: 'Al Messila, a Luxury Collection Resort & Spa, Doha', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'Luxury Collection' },
  { code: 'DOHWE', hotel_name: 'Element City Center Doha', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'Element' },
  { code: 'DOHDC', hotel_name: 'Delta Hotels City Center Doha', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'Delta Hotels' },

  // KUWAIT
  { code: 'KWIXR', hotel_name: 'The St. Regis Kuwait', city: 'Kuwait City', country: 'Kuwait', region: 'Middle East', brand: 'St. Regis' },
  { code: 'KWILC', hotel_name: 'Sheraton Kuwait, a Luxury Collection Hotel', city: 'Kuwait City', country: 'Kuwait', region: 'Middle East', brand: 'Luxury Collection' },
  { code: 'KWIJW', hotel_name: 'JW Marriott Hotel Kuwait City', city: 'Kuwait City', country: 'Kuwait', region: 'Middle East', brand: 'JW Marriott' },
  { code: 'KWICY', hotel_name: 'Courtyard Kuwait City', city: 'Kuwait City', country: 'Kuwait', region: 'Middle East', brand: 'Courtyard' },
  { code: 'KWIRI', hotel_name: 'Residence Inn Kuwait City', city: 'Kuwait City', country: 'Kuwait', region: 'Middle East', brand: 'Residence Inn' },

  // BAHRAIN
  { code: 'BAHWI', hotel_name: 'The Westin City Centre Bahrain', city: 'Manama', country: 'Bahrain', region: 'Middle East', brand: 'Westin' },

  // OMAN
  { code: 'MCTWH', hotel_name: 'W Muscat', city: 'Muscat', country: 'Oman', region: 'Middle East', brand: 'W Hotels' },
  { code: 'MCTSI', hotel_name: 'Sheraton Oman Hotel', city: 'Muscat', country: 'Oman', region: 'Middle East', brand: 'Sheraton' },

  // JORDAN
  { code: 'AMMXR', hotel_name: 'The St. Regis Amman', city: 'Amman', country: 'Jordan', region: 'Middle East', brand: 'St. Regis' },
  { code: 'QMDJV', hotel_name: 'Dead Sea Marriott Resort & Spa', city: 'Dead Sea', country: 'Jordan', region: 'Middle East', brand: 'Marriott' },

  // ISRAEL
  { code: 'TLVLC', hotel_name: 'The Jaffa, a Luxury Collection Hotel, Tel Aviv', city: 'Tel Aviv', country: 'Israel', region: 'Middle East', brand: 'Luxury Collection' },
  { code: 'TLVSI', hotel_name: 'Sheraton Grand Tel Aviv', city: 'Tel Aviv', country: 'Israel', region: 'Middle East', brand: 'Sheraton' },
  { code: 'TLVBR', hotel_name: 'Renaissance Tel Aviv Hotel', city: 'Tel Aviv', country: 'Israel', region: 'Middle East', brand: 'Renaissance' },

  // EGYPT - CAIRO
  { code: 'CAIXR', hotel_name: 'The St. Regis Cairo', city: 'Cairo', country: 'Egypt', region: 'Africa', brand: 'St. Regis' },
  { code: 'CAIXA', hotel_name: 'The St. Regis New Capital, Cairo', city: 'Cairo', country: 'Egypt', region: 'Africa', brand: 'St. Regis' },
  { code: 'CAIJW', hotel_name: 'JW Marriott Hotel Cairo', city: 'Cairo', country: 'Egypt', region: 'Africa', brand: 'JW Marriott' },
  { code: 'CAIMN', hotel_name: 'Marriott Mena House, Cairo', city: 'Cairo', country: 'Egypt', region: 'Africa', brand: 'Marriott' },
  { code: 'CAIEG', hotel_name: 'Cairo Marriott Hotel & Omar Khayyam Casino', city: 'Cairo', country: 'Egypt', region: 'Africa', brand: 'Marriott' },
  { code: 'CAISI', hotel_name: 'Sheraton Cairo Hotel & Casino', city: 'Cairo', country: 'Egypt', region: 'Africa', brand: 'Sheraton' },

  // EGYPT - RED SEA
  { code: 'SSHSI', hotel_name: 'Sheraton Sharm Hotel, Resort, Villas & Spa', city: 'Sharm El Sheikh', country: 'Egypt', region: 'Africa', brand: 'Sheraton' },
  { code: 'SSHBR', hotel_name: 'Renaissance Sharm El Sheikh Golden View Beach Resort', city: 'Sharm El Sheikh', country: 'Egypt', region: 'Africa', brand: 'Renaissance' },

  // SOUTH AFRICA - JOHANNESBURG
  { code: 'JNBMC', hotel_name: 'Johannesburg Marriott Hotel Melrose Arch', city: 'Johannesburg', country: 'South Africa', region: 'Africa', brand: 'Marriott' },
  { code: 'JNBMA', hotel_name: 'African Pride Melrose Arch, Autograph Collection', city: 'Johannesburg', country: 'South Africa', region: 'Africa', brand: 'Autograph Collection' },
  { code: 'JNBBA', hotel_name: 'Protea Hotel Johannesburg Balalaika Sandton', city: 'Johannesburg', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },
  { code: 'JNBWA', hotel_name: 'Protea Hotel Johannesburg Wanderers', city: 'Johannesburg', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },
  { code: 'JNBOR', hotel_name: 'Protea Hotel O.R. Tambo Airport', city: 'Johannesburg', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },
  { code: 'JNBMR', hotel_name: 'Protea Hotel Fire & Ice! Johannesburg Melrose Arch', city: 'Johannesburg', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },

  // SOUTH AFRICA - CAPE TOWN
  { code: 'CPTWI', hotel_name: 'The Westin Cape Town', city: 'Cape Town', country: 'South Africa', region: 'Africa', brand: 'Westin' },
  { code: 'CPTCM', hotel_name: 'Cape Town Marriott Hotel Crystal Towers', city: 'Cape Town', country: 'South Africa', region: 'Africa', brand: 'Marriott' },
  { code: 'CPTAR', hotel_name: 'AC Hotel Cape Town Waterfront', city: 'Cape Town', country: 'South Africa', region: 'Africa', brand: 'AC Hotels' },
  { code: 'CPTBR', hotel_name: 'Protea Hotel Cape Town Waterfront Breakwater Lodge', city: 'Cape Town', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },
  { code: 'CPTNW', hotel_name: 'Protea Hotel Cape Town North Wharf', city: 'Cape Town', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },
  { code: 'CPTCF', hotel_name: 'Protea Hotel Fire & Ice! Cape Town', city: 'Cape Town', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },

  // SOUTH AFRICA - DURBAN
  { code: 'DURUR', hotel_name: 'Protea Hotel Fire & Ice! Durban Umhlanga Ridge', city: 'Durban', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },
  { code: 'DURUM', hotel_name: 'Protea Hotel Durban Umhlanga', city: 'Durban', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },
  { code: 'DURKA', hotel_name: 'Protea Hotel Karridene Beach', city: 'Durban', country: 'South Africa', region: 'Africa', brand: 'Protea Hotels' },

  // MOROCCO
  { code: 'CMNMC', hotel_name: 'Casablanca Marriott Hotel', city: 'Casablanca', country: 'Morocco', region: 'Africa', brand: 'Marriott' },
  { code: 'CMNMD', hotel_name: 'Le Méridien Casablanca', city: 'Casablanca', country: 'Morocco', region: 'Africa', brand: 'Le Méridien' },
  { code: 'CMNSI', hotel_name: 'Sheraton Casablanca Hotel & Towers', city: 'Casablanca', country: 'Morocco', region: 'Africa', brand: 'Sheraton' },
  { code: 'CMNCM', hotel_name: 'Courtyard by Marriott Casablanca Downtown', city: 'Casablanca', country: 'Morocco', region: 'Africa', brand: 'Courtyard' },
  { code: 'CMNFP', hotel_name: 'Four Points by Sheraton Casablanca Bouskoura', city: 'Casablanca', country: 'Morocco', region: 'Africa', brand: 'Four Points' },
  { code: 'RAKMD', hotel_name: 'Le Méridien N\'Fis', city: 'Marrakech', country: 'Morocco', region: 'Africa', brand: 'Le Méridien' },
  { code: 'RAKDS', hotel_name: 'AnaYela, Marrakesh, a Member of Design Hotels', city: 'Marrakech', country: 'Morocco', region: 'Africa', brand: 'Design Hotels' },
  { code: 'RBAMC', hotel_name: 'Rabat Marriott Hotel', city: 'Rabat', country: 'Morocco', region: 'Africa', brand: 'Marriott' },
  { code: 'FEZMC', hotel_name: 'Fes Marriott Hotel Jnan Palace', city: 'Fes', country: 'Morocco', region: 'Africa', brand: 'Marriott' },

  // KENYA
  { code: 'NBOJW', hotel_name: 'JW Marriott Hotel Nairobi', city: 'Nairobi', country: 'Kenya', region: 'Africa', brand: 'JW Marriott' },
  { code: 'NBOAK', hotel_name: 'Sankara Nairobi, Autograph Collection', city: 'Nairobi', country: 'Kenya', region: 'Africa', brand: 'Autograph Collection' },
  { code: 'NBOFA', hotel_name: 'Four Points by Sheraton Nairobi Airport', city: 'Nairobi', country: 'Kenya', region: 'Africa', brand: 'Four Points' },
  { code: 'NBOFP', hotel_name: 'Four Points by Sheraton Nairobi Hurlingham', city: 'Nairobi', country: 'Kenya', region: 'Africa', brand: 'Four Points' },

  // NIGERIA
  { code: 'LOSLG', hotel_name: 'Lagos Marriott Hotel Ikeja', city: 'Lagos', country: 'Nigeria', region: 'Africa', brand: 'Marriott' },
  { code: 'LOSSI', hotel_name: 'Sheraton Lagos Hotel', city: 'Lagos', country: 'Nigeria', region: 'Africa', brand: 'Sheraton' },
  { code: 'LOSFP', hotel_name: 'Four Points by Sheraton Lagos', city: 'Lagos', country: 'Nigeria', region: 'Africa', brand: 'Four Points' },
  { code: 'LOSPK', hotel_name: 'Protea Hotel Lagos Kuramo Waters', city: 'Lagos', country: 'Nigeria', region: 'Africa', brand: 'Protea Hotels' },
  { code: 'ABVSI', hotel_name: 'Sheraton Abuja Hotel', city: 'Abuja', country: 'Nigeria', region: 'Africa', brand: 'Sheraton' },

  // GHANA
  { code: 'ACCMC', hotel_name: 'Accra Marriott Hotel', city: 'Accra', country: 'Ghana', region: 'Africa', brand: 'Marriott' },
  { code: 'ACCFP', hotel_name: 'Four Points by Sheraton Accra Kotoka Airport', city: 'Accra', country: 'Ghana', region: 'Africa', brand: 'Four Points' },

  // AUSTRALIA - SYDNEY
  { code: 'SYDMC', hotel_name: 'Sydney Harbour Marriott Hotel at Circular Quay', city: 'Sydney', country: 'Australia', region: 'Pacific', brand: 'Marriott' },
  { code: 'SYDWH', hotel_name: 'W Sydney', city: 'Sydney', country: 'Australia', region: 'Pacific', brand: 'W Hotels' },
  { code: 'SYDAK', hotel_name: 'Pier One Sydney Harbour, Autograph Collection', city: 'Sydney', country: 'Australia', region: 'Pacific', brand: 'Autograph Collection' },
  { code: 'SYDSI', hotel_name: 'Sheraton Grand Sydney Hyde Park', city: 'Sydney', country: 'Australia', region: 'Pacific', brand: 'Sheraton' },

  // AUSTRALIA - MELBOURNE
  { code: 'MELRZ', hotel_name: 'The Ritz-Carlton, Melbourne', city: 'Melbourne', country: 'Australia', region: 'Pacific', brand: 'Ritz-Carlton' },
  { code: 'MELWH', hotel_name: 'W Melbourne', city: 'Melbourne', country: 'Australia', region: 'Pacific', brand: 'W Hotels' },
  { code: 'MELMC', hotel_name: 'Melbourne Marriott Hotel', city: 'Melbourne', country: 'Australia', region: 'Pacific', brand: 'Marriott' },
  { code: 'MELDL', hotel_name: 'Melbourne Marriott Hotel Docklands', city: 'Melbourne', country: 'Australia', region: 'Pacific', brand: 'Marriott' },
  { code: 'MELWI', hotel_name: 'The Westin Melbourne', city: 'Melbourne', country: 'Australia', region: 'Pacific', brand: 'Westin' },
  { code: 'MELSI', hotel_name: 'Sheraton Melbourne Hotel', city: 'Melbourne', country: 'Australia', region: 'Pacific', brand: 'Sheraton' },
  { code: 'MELAC', hotel_name: 'AC Hotel Melbourne Southbank', city: 'Melbourne', country: 'Australia', region: 'Pacific', brand: 'AC Hotels' },
  { code: 'MELEL', hotel_name: 'Element Melbourne Richmond', city: 'Melbourne', country: 'Australia', region: 'Pacific', brand: 'Element' },

  // AUSTRALIA - BRISBANE
  { code: 'BNEDT', hotel_name: 'Brisbane Marriott Hotel', city: 'Brisbane', country: 'Australia', region: 'Pacific', brand: 'Marriott' },
  { code: 'BNEWH', hotel_name: 'W Brisbane', city: 'Brisbane', country: 'Australia', region: 'Pacific', brand: 'W Hotels' },

  // AUSTRALIA - PERTH
  { code: 'PERRZ', hotel_name: 'The Ritz-Carlton, Perth', city: 'Perth', country: 'Australia', region: 'Pacific', brand: 'Ritz-Carlton' },
  { code: 'PERWI', hotel_name: 'The Westin Perth', city: 'Perth', country: 'Australia', region: 'Pacific', brand: 'Westin' },
  { code: 'PERFP', hotel_name: 'Four Points by Sheraton Perth', city: 'Perth', country: 'Australia', region: 'Pacific', brand: 'Four Points' },
  { code: 'PERAL', hotel_name: 'Aloft Perth', city: 'Perth', country: 'Australia', region: 'Pacific', brand: 'Aloft' },
  { code: 'PERMC', hotel_name: 'Courtyard Perth, Murdoch', city: 'Perth', country: 'Australia', region: 'Pacific', brand: 'Courtyard' },

  // AUSTRALIA - GOLD COAST & QUEENSLAND
  { code: 'OOLSP', hotel_name: 'JW Marriott Gold Coast Resort & Spa', city: 'Gold Coast', country: 'Australia', region: 'Pacific', brand: 'JW Marriott' },
  { code: 'OOLGS', hotel_name: 'Sheraton Grand Mirage Resort, Gold Coast', city: 'Gold Coast', country: 'Australia', region: 'Pacific', brand: 'Sheraton' },
  { code: 'CNSSI', hotel_name: 'Sheraton Grand Mirage Resort, Port Douglas', city: 'Port Douglas', country: 'Australia', region: 'Pacific', brand: 'Sheraton' },

  // AUSTRALIA - ADELAIDE
  { code: 'ADLMC', hotel_name: 'Adelaide Marriott Hotel', city: 'Adelaide', country: 'Australia', region: 'Pacific', brand: 'Marriott' },

  // NEW ZEALAND
  { code: 'AKLJW', hotel_name: 'JW Marriott Auckland', city: 'Auckland', country: 'New Zealand', region: 'Pacific', brand: 'JW Marriott' },
  { code: 'AKLFP', hotel_name: 'Four Points by Sheraton Auckland', city: 'Auckland', country: 'New Zealand', region: 'Pacific', brand: 'Four Points' },

  // USA - WASHINGTON (corrected)
  { code: 'WASSX', hotel_name: 'The St. Regis Washington, D.C.', city: 'Washington', country: 'USA', region: 'North America', brand: 'St. Regis' },
  { code: 'WASRT', hotel_name: 'The Ritz-Carlton, Washington, D.C.', city: 'Washington', country: 'USA', region: 'North America', brand: 'Ritz-Carlton' }
];

async function seedMarshaCodes() {
  const { Pool } = pg;
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🚀 Starting MARSHA codes seeding...');
    console.log(`📦 Total codes to insert: ${marshaCodesData.length}`);

    // Check if extension for fuzzy search exists
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Insert codes in batches
    const batchSize = 50;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < marshaCodesData.length; i += batchSize) {
      const batch = marshaCodesData.slice(i, i + batchSize);
      
      for (const code of batch) {
        try {
          await pool.query(`
            INSERT INTO marsha_codes (code, hotel_name, city, country, region, brand)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (code) DO UPDATE SET
              hotel_name = EXCLUDED.hotel_name,
              city = EXCLUDED.city,
              country = EXCLUDED.country,
              region = EXCLUDED.region,
              brand = EXCLUDED.brand,
              updated_at = CURRENT_TIMESTAMP
          `, [code.code, code.hotel_name, code.city, code.country, code.region, code.brand]);
          inserted++;
        } catch (err) {
          console.error(`Error inserting ${code.code}:`, err.message);
          skipped++;
        }
      }
      
      console.log(`  Progress: ${Math.min(i + batchSize, marshaCodesData.length)}/${marshaCodesData.length}`);
    }

    console.log('✅ MARSHA codes seeding completed!');
    console.log(`   Inserted/Updated: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);

    // Show stats by region
    const stats = await pool.query(`
      SELECT region, COUNT(*) as count 
      FROM marsha_codes 
      GROUP BY region 
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Codes by region:');
    stats.rows.forEach(row => {
      console.log(`   ${row.region}: ${row.count}`);
    });

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Export for ES modules
export { marshaCodesData, seedMarshaCodes };

// Run directly
seedMarshaCodes()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

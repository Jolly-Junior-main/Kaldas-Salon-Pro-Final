/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EthDateTime } from 'ethiopian-calendar-date-converter';

export const ETHIOPIAN_MONTHS_EN = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miyazya',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume'
];

export const ETHIOPIAN_MONTHS_AM = [
  'መስከረም',
  'ጥቅምት',
  'ህዳር',
  'ታህሳስ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'ጳጉሜ'
];

export interface ETDate {
  year: number;
  month: number; // 1-indexed (1 = Meskerem, 13 = Pagume)
  day: number;
}

/**
 * Converts a Gregorian date string (YYYY-MM-DD) to an ETDate object.
 */
export function convertToEthiopian(gregDateStr: string): ETDate | null {
  if (!gregDateStr) return null;
  try {
    const parts = gregDateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    
    // Create Date using UTC/local correctly
    const dateObj = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone offset shifts
    const ethDateTime = EthDateTime.fromEuropeanDate(dateObj);
    return {
      year: ethDateTime.year,
      month: ethDateTime.month,
      day: ethDateTime.date
    };
  } catch (e) {
    console.error('Error converting to Ethiopian calendar:', e);
    return null;
  }
}

/**
 * Converts an Ethiopian date (year, month, day) to a Gregorian Date object.
 */
export function convertToGregorian(etYear: number, etMonth: number, etDay: number): Date | null {
  try {
    const ethDateTime = new EthDateTime(etYear, etMonth, etDay);
    return ethDateTime.toEuropeanDate();
  } catch (e) {
    console.error('Error converting to Gregorian calendar:', e);
    return null;
  }
}

/**
 * Formats an ETDate object into a readable string based on selected language.
 */
export function formatEthiopianDate(etDate: ETDate | null, lang: 'en' | 'am'): string {
  if (!etDate) return '';
  const months = lang === 'am' ? ETHIOPIAN_MONTHS_AM : ETHIOPIAN_MONTHS_EN;
  const monthName = months[etDate.month - 1] || `Month ${etDate.month}`;
  
  if (lang === 'am') {
    return `${monthName} ${etDate.day} ቀን ${etDate.year} ዓ.ም.`;
  }
  return `${monthName} ${etDate.day}, ${etDate.year} EC`;
}

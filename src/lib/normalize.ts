// © 2026 김용현
// (C) 2026 Kim Yonghyun
// Strip whitespace and invisible chars from user input.
// Covers: ASCII whitespace (\s), NBSP, zero-width chars (ZWSP/ZWNJ/ZWJ), BOM.

const WHITESPACE_RE = /[\s ​‌‍﻿]+/g;

export function normalizeName(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(WHITESPACE_RE, '').normalize('NFC');
}

export function normalizePhone(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(WHITESPACE_RE, '');
}

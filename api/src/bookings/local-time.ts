import { TZDate } from '@date-fns/tz';

// Conversões entre a hora local do prestador e os instantes UTC do banco
// (ADR 0005). Funções puras, sem relógio do sistema.

export type Interval = { start: Date; end: Date };

function parseDate(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number);
  return [year, month, day];
}

// "2026-11-23" e "09:00" no fuso do prestador viram um instante UTC.
export function localToUtc(date: string, time: string, timezone: string): Date {
  const [year, month, day] = parseDate(date);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    new TZDate(year, month - 1, day, hours, minutes, timezone).getTime(),
  );
}

// 0 = domingo. O dia da semana de uma data não depende do fuso.
export function weekdayOf(date: string): number {
  const [year, month, day] = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// Do início do dia ao início do dia seguinte, no fuso do prestador. Num dia
// de troca de horário de verão, o intervalo tem 23 ou 25 horas.
export function localDay(date: string, timezone: string): Interval {
  const [year, month, day] = parseDate(date);
  return {
    start: new Date(new TZDate(year, month - 1, day, timezone).getTime()),
    end: new Date(new TZDate(year, month - 1, day + 1, timezone).getTime()),
  };
}

// A data de hoje (YYYY-MM-DD) no fuso do prestador.
export function localDateOf(instant: Date, timezone: string): string {
  const local = new TZDate(instant.getTime(), timezone);
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${local.getFullYear()}-${month}-${day}`;
}

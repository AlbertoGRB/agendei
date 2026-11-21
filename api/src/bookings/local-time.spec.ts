import { localDateOf, localDay, localToUtc, weekdayOf } from './local-time.js';

const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';

describe('localToUtc', () => {
  it('converte a hora de Brasília para UTC (3 horas a mais)', () => {
    expect(localToUtc('2026-11-23', '09:00', SP).toISOString()).toBe(
      '2026-11-23T12:00:00.000Z',
    );
  });

  it('23h30 em Brasília já é o dia seguinte em UTC', () => {
    expect(localToUtc('2026-11-23', '23:30', SP).toISOString()).toBe(
      '2026-11-24T02:30:00.000Z',
    );
  });

  it('respeita o horário de verão de outro fuso', () => {
    // Em Nova York, 08/03/2026 às 2h os relógios pulam para as 3h.
    expect(localToUtc('2026-03-08', '01:00', NY).toISOString()).toBe(
      '2026-03-08T06:00:00.000Z',
    );
    expect(localToUtc('2026-03-08', '04:00', NY).toISOString()).toBe(
      '2026-03-08T08:00:00.000Z',
    );
  });
});

describe('weekdayOf', () => {
  it.each([
    ['2026-11-22', 0],
    ['2026-11-23', 1],
    ['2026-11-28', 6],
  ])('%s cai no dia %i da semana', (date, weekday) => {
    expect(weekdayOf(date)).toBe(weekday);
  });
});

describe('localDay', () => {
  it('o dia em Brasília vai das 3h UTC às 3h UTC do dia seguinte', () => {
    const day = localDay('2026-11-23', SP);

    expect(day.start.toISOString()).toBe('2026-11-23T03:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-11-24T03:00:00.000Z');
  });

  it('o dia da troca para o horário de verão tem 23 horas', () => {
    const day = localDay('2026-03-08', NY);

    expect((day.end.getTime() - day.start.getTime()) / 3_600_000).toBe(23);
  });

  it('o último dia do mês termina no primeiro do mês seguinte', () => {
    expect(localDay('2026-11-30', SP).end.toISOString()).toBe(
      '2026-12-01T03:00:00.000Z',
    );
  });
});

describe('localDateOf', () => {
  it('2h UTC ainda é o dia anterior em Brasília', () => {
    expect(localDateOf(new Date('2026-11-24T02:00:00Z'), SP)).toBe(
      '2026-11-23',
    );
  });

  it('completa mês e dia com zero', () => {
    expect(localDateOf(new Date('2026-03-05T12:00:00Z'), SP)).toBe(
      '2026-03-05',
    );
  });
});

import {
  dayLabel,
  formatDuration,
  formatPrice,
  formatWhen,
  nextDays,
} from './format';

describe('formatação', () => {
  it('preço em reais, a partir dos centavos', () => {
    expect(formatPrice(5000)).toMatch(/^R\$\s50,00$/);
    expect(formatPrice(4990)).toMatch(/^R\$\s49,90$/);
  });

  it('duração em horas e minutos', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
  });

  it('os próximos dias atravessam a virada do mês', () => {
    expect(nextDays(3, new Date(2030, 0, 30, 23, 59))).toEqual([
      '2030-01-30',
      '2030-01-31',
      '2030-02-01',
    ]);
  });

  it('rótulo do dia, curto e por extenso', () => {
    expect(dayLabel('2030-01-07')).toEqual({
      weekday: 'seg.',
      date: '07/01',
      full: 'segunda-feira, 7 de janeiro',
    });
  });

  it('dia e hora no fuso do prestador: 2h30 em UTC ainda é dia 7 em Brasília', () => {
    expect(formatWhen('2030-01-08T02:30:00.000Z', 'America/Sao_Paulo')).toBe(
      'segunda-feira, 7 de janeiro, às 23:30',
    );
  });
});

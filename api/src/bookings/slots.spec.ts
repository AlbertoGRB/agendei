import { localToUtc, type Interval } from './local-time.js';
import { freeSlots } from './slots.js';

const SP = 'America/Sao_Paulo';
const DAY = '2026-11-23';
// Bem antes do dia, para nenhum horário ter passado.
const LONG_BEFORE = new Date('2026-11-01T00:00:00Z');

// Horas locais de Brasília no dia do teste.
const at = (time: string) => localToUtc(DAY, time, SP);
const window = (start: string, end: string): Interval => ({
  start: at(start),
  end: at(end),
});
// Converte a resposta de volta para HH:mm de Brasília, para o teste ler fácil.
const asLocal = (slots: Date[]) =>
  slots.map((slot) =>
    new Date(slot.getTime() - 3 * 3_600_000).toISOString().slice(11, 16),
  );

describe('freeSlots', () => {
  it('oferece horários de 30 em 30 minutos em que o serviço cabe inteiro', () => {
    const slots = freeSlots({
      windows: [window('09:00', '12:00')],
      bookings: [],
      durationMinutes: 60,
      now: LONG_BEFORE,
    });

    expect(asLocal(slots)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
    ]);
  });

  it('devolve instantes em UTC', () => {
    const slots = freeSlots({
      windows: [window('09:00', '10:00')],
      bookings: [],
      durationMinutes: 60,
      now: LONG_BEFORE,
    });

    expect(slots.map((slot) => slot.toISOString())).toEqual([
      '2026-11-23T12:00:00.000Z',
    ]);
  });

  it('o intervalo de almoço não gera horário', () => {
    const slots = freeSlots({
      windows: [window('09:00', '12:00'), window('14:00', '18:00')],
      bookings: [],
      durationMinutes: 120,
      now: LONG_BEFORE,
    });

    expect(asLocal(slots)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
    ]);
  });

  it('serviço maior que a janela não gera horário', () => {
    const slots = freeSlots({
      windows: [window('09:00', '10:00')],
      bookings: [],
      durationMinutes: 90,
      now: LONG_BEFORE,
    });

    expect(slots).toEqual([]);
  });

  it('dia sem atendimento não tem horário', () => {
    const slots = freeSlots({
      windows: [],
      bookings: [],
      durationMinutes: 30,
      now: LONG_BEFORE,
    });

    expect(slots).toEqual([]);
  });

  it('tira o horário reservado e os que se sobreporiam a ele', () => {
    const slots = freeSlots({
      windows: [window('09:00', '12:00')],
      bookings: [window('10:00', '11:00')],
      durationMinutes: 60,
      now: LONG_BEFORE,
    });

    // 09:30 terminaria às 10:30 e 10:30 começaria antes das 11:00.
    expect(asLocal(slots)).toEqual(['09:00', '11:00']);
  });

  it('reserva que só encosta não tira horário', () => {
    const slots = freeSlots({
      windows: [window('09:00', '11:00')],
      bookings: [window('10:00', '11:00')],
      durationMinutes: 60,
      now: LONG_BEFORE,
    });

    expect(asLocal(slots)).toEqual(['09:00']);
  });

  it('reserva que cruza o início da janela também ocupa', () => {
    const slots = freeSlots({
      windows: [window('09:00', '11:00')],
      bookings: [window('08:30', '09:30')],
      durationMinutes: 30,
      now: LONG_BEFORE,
    });

    expect(asLocal(slots)).toEqual(['09:30', '10:00', '10:30']);
  });

  it('hoje, os horários que já passaram não aparecem', () => {
    const slots = freeSlots({
      windows: [window('09:00', '12:00')],
      bookings: [],
      durationMinutes: 60,
      now: at('10:15'),
    });

    expect(asLocal(slots)).toEqual(['10:30', '11:00']);
  });

  it('o horário que começa agora já não é oferecido', () => {
    const slots = freeSlots({
      windows: [window('09:00', '11:00')],
      bookings: [],
      durationMinutes: 60,
      now: at('10:00'),
    });

    expect(asLocal(slots)).toEqual([]);
  });

  it('devolve em ordem mesmo com as janelas fora de ordem', () => {
    const slots = freeSlots({
      windows: [window('14:00', '15:00'), window('09:00', '10:00')],
      bookings: [],
      durationMinutes: 60,
      now: LONG_BEFORE,
    });

    expect(asLocal(slots)).toEqual(['09:00', '14:00']);
  });

  it('no dia do horário de verão, conta as horas reais', () => {
    // Em Nova York, das 1h às 4h de 08/03/2026 passam só 2 horas.
    const ny = (time: string) =>
      localToUtc('2026-03-08', time, 'America/New_York');
    const slots = freeSlots({
      windows: [{ start: ny('01:00'), end: ny('04:00') }],
      bookings: [],
      durationMinutes: 60,
      now: new Date('2026-01-01T00:00:00Z'),
    });

    expect(slots.map((slot) => slot.toISOString())).toEqual([
      '2026-03-08T06:00:00.000Z',
      '2026-03-08T06:30:00.000Z',
      '2026-03-08T07:00:00.000Z',
    ]);
  });
});

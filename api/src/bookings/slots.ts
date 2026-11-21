import type { Interval } from './local-time.js';

const STEP_MS = 30 * 60_000;

export type SlotsInput = {
  // Janelas de atendimento do dia, já em instantes UTC.
  windows: Interval[];
  // Reservas confirmadas do prestador que podem cruzar o dia (RN06).
  bookings: Interval[];
  durationMinutes: number;
  // A hora atual entra como parâmetro, para o teste não depender do relógio.
  now: Date;
};

// Horários de início livres, de 30 em 30 minutos (RN04). Função pura: não
// consulta banco nem relógio. Mostra as opções ao cliente; quem garante que
// não há duas reservas no mesmo horário é o banco (ADR 0002).
export function freeSlots({
  windows,
  bookings,
  durationMinutes,
  now,
}: SlotsInput): Date[] {
  const duration = durationMinutes * 60_000;
  const slots: Date[] = [];

  for (const window of windows) {
    const windowEnd = window.end.getTime();
    // O serviço precisa caber inteiro na janela.
    for (
      let start = window.start.getTime();
      start + duration <= windowEnd;
      start += STEP_MS
    ) {
      const end = start + duration;
      // RN05: horário que já começou não é oferecido.
      const past = start <= now.getTime();
      // Sobrepõe quando começa antes do fim da reserva e termina depois do
      // início dela. Encostar não é sobrepor.
      const taken = bookings.some(
        (booking) =>
          booking.start.getTime() < end && booking.end.getTime() > start,
      );
      if (!past && !taken) {
        slots.push(new Date(start));
      }
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

import type { BookingStatus, Role } from '../generated/prisma/client.js';

// O cliente cancela até 2 horas antes do início (RN08).
export const CLIENT_CANCEL_LIMIT_MS = 2 * 60 * 60_000;

// Diz por que a reserva não pode ser cancelada, ou null se pode. Função
// pura: a hora atual entra como parâmetro.
export function cancellationProblem(
  booking: { status: BookingStatus; startsAt: Date },
  by: Role,
  now: Date,
): string | null {
  if (booking.status === 'CANCELLED') {
    return 'Essa reserva já foi cancelada';
  }
  const timeLeft = booking.startsAt.getTime() - now.getTime();
  // O prestador cancela qualquer reserva que ainda não começou.
  if (timeLeft <= 0) {
    return 'Essa reserva já começou';
  }
  if (by === 'CLIENT' && timeLeft < CLIENT_CANCEL_LIMIT_MS) {
    return 'O cliente só cancela até 2 horas antes do início';
  }
  return null;
}

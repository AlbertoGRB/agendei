import { api, post } from './client';

export type Booking = {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  // Fuso do prestador, em que o horário vale.
  timezone: string;
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  };
  provider: { id: string; name: string };
  client: { id: string; name: string };
};

export function createBooking(
  serviceId: string,
  startsAt: string,
): Promise<Booking> {
  return api('/bookings', post({ serviceId, startsAt }));
}

// Reservas do cliente, da mais nova para a mais antiga.
export function listMyBookings(): Promise<Booking[]> {
  return api('/bookings');
}

export function cancelBooking(id: string): Promise<Booking> {
  return api(`/bookings/${encodeURIComponent(id)}/cancel`, post());
}

export type Agenda = {
  date: string;
  timezone: string;
  // Só as confirmadas, em ordem de horário.
  bookings: Booking[];
};

// Agenda do prestador num dia do fuso dele.
export function getAgenda(date: string): Promise<Agenda> {
  return api(`/agenda?${new URLSearchParams({ date })}`);
}

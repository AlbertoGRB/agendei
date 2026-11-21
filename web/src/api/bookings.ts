import { api, post } from './client';

export type Booking = {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
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

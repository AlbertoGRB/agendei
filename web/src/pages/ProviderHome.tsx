import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { User } from '../api/auth';
import { getAgenda, type Booking } from '../api/bookings';
import { messageOf } from '../api/client';
import { SecondaryButton } from '../components/Button';
import { CancelBooking } from '../components/CancelBooking';
import { FormError } from '../components/FormError';
import {
  addDays,
  dayLabel,
  formatTime,
  timeZoneName,
  todayIn,
} from '../lib/format';

// Início do prestador: a agenda do dia, no fuso dele (RF06), com o
// cancelamento das reservas que ainda não começaram (RF12).
export function ProviderHome({ user }: { user: User }) {
  const [today] = useState(() => todayIn(user.timezone));
  const [day, setDay] = useState(today);
  const [cancelled, setCancelled] = useState<Booking | null>(null);
  const message = useRef<HTMLParagraphElement>(null);

  const agenda = useQuery({
    queryKey: ['agenda', day],
    queryFn: () => getAgenda(day),
  });

  useEffect(() => {
    if (cancelled) {
      message.current?.focus();
    }
  }, [cancelled]);

  const changeDay = (value: string) => {
    setDay(value);
    setCancelled(null);
  };

  return (
    <section>
      <title>Agenda · agendei</title>
      <h1 className="text-2xl font-bold">Olá, {user.name.split(' ')[0]}</h1>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Agenda de {dayLabel(day).full}
        </h2>
        {/* No celular, a data ocupa uma linha e os botões dividem a de baixo. */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <label className="sr-only" htmlFor="agenda-dia">
            Dia
          </label>
          <input
            id="agenda-dia"
            type="date"
            value={day}
            onChange={(event) => {
              if (event.target.value) {
                changeDay(event.target.value);
              }
            }}
            className="col-span-2 rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          />
          <SecondaryButton
            type="button"
            className="gap-1"
            onClick={() => changeDay(addDays(day, -1))}
          >
            <span aria-hidden="true">‹</span>Dia anterior
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="gap-1"
            onClick={() => changeDay(addDays(day, 1))}
          >
            Próximo dia<span aria-hidden="true">›</span>
          </SecondaryButton>
          {day !== today && (
            <SecondaryButton
              type="button"
              className="col-span-2"
              onClick={() => changeDay(today)}
            >
              Hoje
            </SecondaryButton>
          )}
        </div>
      </div>

      {cancelled && (
        <p
          ref={message}
          tabIndex={-1}
          className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 focus:outline-none"
        >
          Reserva cancelada: {cancelled.service.name} com{' '}
          {cancelled.client.name}, às{' '}
          {formatTime(cancelled.startsAt, cancelled.timezone)}. O cliente vai
          receber um e-mail com o cancelamento.
        </p>
      )}

      <div className="mt-4">
        {agenda.isPending ? (
          <output className="block text-slate-600">Carregando a agenda…</output>
        ) : agenda.isError ? (
          <FormError message={messageOf(agenda.error)} />
        ) : agenda.data.bookings.length === 0 ? (
          <p className="text-slate-700">Nenhuma reserva neste dia.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {agenda.data.bookings.map((booking) => (
                <AgendaItem
                  key={booking.id}
                  booking={booking}
                  timezone={agenda.data.timezone}
                  now={agenda.dataUpdatedAt}
                  onCancelled={setCancelled}
                />
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-600">
              Horários em {timeZoneName(agenda.data.timezone)}.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function AgendaItem({
  booking,
  timezone,
  now,
  onCancelled,
}: {
  booking: Booking;
  timezone: string;
  now: number;
  onCancelled: (booking: Booking) => void;
}) {
  const start = formatTime(booking.startsAt, timezone);
  const end = formatTime(booking.endsAt, timezone);
  // O prestador cancela até o início da reserva (RN08).
  const open = new Date(booking.startsAt).getTime() > now;

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-semibold tabular-nums">
        {start} às {end}
      </h3>
      <p className="mt-0.5 text-slate-700">
        {booking.service.name} com {booking.client.name}
      </p>
      {open && (
        <CancelBooking
          booking={booking}
          description={`de ${booking.client.name}, às ${start}`}
          onCancelled={onCancelled}
        />
      )}
    </li>
  );
}

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { createBooking, type Booking } from '../api/bookings';
import { ApiError, messageOf } from '../api/client';
import { getProvider, getSlots, type Slots } from '../api/providers';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { FormError } from '../components/FormError';
import { Loading } from '../components/Loading';
import {
  dayLabel,
  formatDuration,
  formatPrice,
  formatTime,
  formatWhen,
  nextDays,
  timeZoneName,
} from '../lib/format';

// Quantos dias, a partir de hoje, o cliente pode escolher.
const DAYS_AHEAD = 14;

type NewBooking = { serviceId: string; startsAt: string; timezone: string };

// Reserva em 4 passos depois de escolher o prestador: serviço, dia, horário
// e confirmar (RNF05).
export function BookPage() {
  const { providerId = '' } = useParams();
  const queryClient = useQueryClient();
  const [days] = useState(() => nextDays(DAYS_AHEAD));
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const provider = useQuery({
    queryKey: ['providers', providerId],
    queryFn: () => getProvider(providerId),
  });
  const slots = useQuery({
    queryKey: ['slots', providerId, serviceId, day],
    queryFn:
      serviceId && day ? () => getSlots(providerId, serviceId, day) : skipToken,
  });
  const booking = useMutation({
    mutationFn: (choice: NewBooking) =>
      createBooking(choice.serviceId, choice.startsAt),
    onSettled: () => {
      // O horário reservado sai da lista. No 409, a lista mostra o que sobrou.
      void queryClient.invalidateQueries({ queryKey: ['slots', providerId] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setSlot(null);
      }
    },
  });

  if (provider.isPending) {
    return <Loading />;
  }
  if (provider.isError) {
    return (
      <section>
        <title>Prestador · agendei</title>
        <FormError message={messageOf(provider.error)} />
        <BackLink />
      </section>
    );
  }
  if (booking.isSuccess) {
    return (
      <Confirmed
        booking={booking.data}
        timezone={booking.variables.timezone}
        onAgain={() => {
          booking.reset();
          setSlot(null);
        }}
      />
    );
  }

  const { name, services } = provider.data;
  const service = services.find((s) => s.id === serviceId);
  const timezone = slots.data?.timezone;

  // Mudar uma escolha apaga as que dependem dela e o erro da última tentativa.
  const chooseService = (id: string) => {
    setServiceId(id);
    setSlot(null);
    booking.reset();
  };
  const chooseDay = (value: string) => {
    setDay(value);
    setSlot(null);
    booking.reset();
  };
  const chooseSlot = (value: string) => {
    setSlot(value);
    booking.reset();
  };

  return (
    <section>
      <title>{`${name} · agendei`}</title>
      <BackLink />
      <h1 className="mt-3 text-2xl font-bold">{name}</h1>
      <p className="mt-1 text-slate-700">
        Escolha o serviço, o dia e o horário.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <fieldset>
          <legend className="mb-2 font-semibold">Serviço</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <Choice
                key={s.id}
                name="servico"
                value={s.id}
                checked={s.id === serviceId}
                onChange={chooseService}
              >
                <span className="block px-3 py-2.5">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-sm">
                    {formatDuration(s.durationMinutes)} ·{' '}
                    {formatPrice(s.priceCents)}
                  </span>
                </span>
              </Choice>
            ))}
          </div>
        </fieldset>

        {service && (
          <fieldset>
            <legend className="mb-2 font-semibold">Dia</legend>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((d) => {
                const label = dayLabel(d);
                return (
                  <Choice
                    key={d}
                    name="dia"
                    value={d}
                    checked={d === day}
                    onChange={chooseDay}
                  >
                    <span className="block py-2 text-center tabular-nums">
                      <span aria-hidden="true" className="block text-xs">
                        {label.weekday}
                      </span>
                      <span
                        aria-hidden="true"
                        className="block text-xs font-semibold sm:text-sm"
                      >
                        {label.date}
                      </span>
                      <span className="sr-only">{label.full}</span>
                    </span>
                  </Choice>
                );
              })}
            </div>
          </fieldset>
        )}

        {service && day && (
          <fieldset>
            <legend className="mb-2 font-semibold">Horário</legend>
            <SlotPicker query={slots} selected={slot} onChange={chooseSlot} />
          </fieldset>
        )}

        {booking.isError && <FormError message={bookingError(booking.error)} />}

        {service && slot && timezone && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Confirme a reserva</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-slate-600">Serviço</dt>
              <dd>
                {service.name} ({formatDuration(service.durationMinutes)} ·{' '}
                {formatPrice(service.priceCents)})
              </dd>
              <dt className="text-slate-600">Com</dt>
              <dd>{name}</dd>
              <dt className="text-slate-600">Quando</dt>
              <dd>{formatWhen(slot, timezone)}</dd>
            </dl>
            <Button
              type="button"
              className="mt-4 w-full sm:w-auto"
              disabled={booking.isPending}
              onClick={() =>
                booking.mutate({
                  serviceId: service.id,
                  startsAt: slot,
                  timezone,
                })
              }
            >
              {booking.isPending ? 'Reservando…' : 'Confirmar reserva'}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function SlotPicker({
  query,
  selected,
  onChange,
}: {
  query: UseQueryResult<Slots>;
  selected: string | null;
  onChange: (slot: string) => void;
}) {
  if (query.isPending) {
    return (
      <output className="block text-slate-600">Carregando horários…</output>
    );
  }
  if (query.isError) {
    return <FormError message={messageOf(query.error)} />;
  }
  const { slots, timezone } = query.data;
  if (slots.length === 0) {
    return <p className="text-slate-700">Sem horários neste dia.</p>;
  }
  return (
    <>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {slots.map((s) => (
          <Choice
            key={s}
            name="horario"
            value={s}
            checked={s === selected}
            onChange={onChange}
          >
            <span className="block py-2 text-center font-medium">
              {formatTime(s, timezone)}
            </span>
          </Choice>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Horários em {timeZoneName(timezone)}.
      </p>
    </>
  );
}

function Confirmed({
  booking,
  timezone,
  onAgain,
}: {
  booking: Booking;
  timezone: string;
  onAgain: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Leva o foco para o título, e o leitor de tela anuncia a confirmação.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section>
      <title>Reserva confirmada · agendei</title>
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-bold focus:outline-none"
      >
        Reserva confirmada
      </h1>
      <p className="mt-2">
        {booking.service.name} com {booking.provider.name},{' '}
        {formatWhen(booking.startsAt, timezone)}.
      </p>
      <p className="mt-1 text-slate-700">
        Você vai receber a confirmação por e-mail.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="button" onClick={onAgain}>
          Reservar outro horário
        </Button>
        <Link to="/" className="font-semibold text-teal-800 underline">
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}

function BackLink() {
  return (
    <Link to="/" className="text-sm font-semibold text-teal-800 underline">
      Voltar aos prestadores
    </Link>
  );
}

// No 409, outro cliente reservou o horário um instante antes (US06).
function bookingError(error: Error): string {
  return error instanceof ApiError && error.status === 409
    ? 'Esse horário acabou de ser reservado. Escolha outro.'
    : messageOf(error);
}

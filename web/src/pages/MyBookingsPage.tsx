import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { cancelBooking, listMyBookings, type Booking } from '../api/bookings';
import { messageOf } from '../api/client';
import { FormError } from '../components/FormError';
import { Loading } from '../components/Loading';
import { formatWhen } from '../lib/format';

// O cliente cancela até 2 horas antes do início (RN08). A tela só esconde o
// botão; quem decide é a API.
const CANCEL_LIMIT_MS = 2 * 60 * 60_000;

const secondaryButton =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

// Minhas reservas (RF10): as próximas primeiro, e o cancelamento (RF11).
export function MyBookingsPage() {
  const bookings = useQuery({
    queryKey: ['bookings'],
    queryFn: listMyBookings,
  });
  const [cancelled, setCancelled] = useState<Booking | null>(null);
  const message = useRef<HTMLParagraphElement>(null);

  // Depois de cancelar, a reserva muda de lista e o botão some. O foco vai
  // para o aviso, e o leitor de tela lê o que aconteceu.
  useEffect(() => {
    if (cancelled) {
      message.current?.focus();
    }
  }, [cancelled]);

  if (bookings.isPending) {
    return <Loading />;
  }

  // O "agora" é a hora em que a lista chegou: as duas mudam juntas, quando
  // a lista é buscada de novo.
  const now = bookings.dataUpdatedAt;
  const all = bookings.data ?? [];
  const upcoming = all
    .filter(
      (b) => b.status === 'CONFIRMED' && new Date(b.startsAt).getTime() > now,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = all.filter((b) => !upcoming.includes(b));

  return (
    <section>
      <title>Minhas reservas · agendei</title>
      <h1 className="text-2xl font-bold">Minhas reservas</h1>

      {cancelled && (
        <p
          ref={message}
          tabIndex={-1}
          className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 focus:outline-none"
        >
          Reserva cancelada: {cancelled.service.name} com{' '}
          {cancelled.provider.name},{' '}
          {formatWhen(cancelled.startsAt, cancelled.timezone)}. Você vai receber
          um e-mail com o cancelamento.
        </p>
      )}

      {bookings.isError ? (
        <div className="mt-4">
          <FormError message={messageOf(bookings.error)} />
        </div>
      ) : all.length === 0 ? (
        <p className="mt-4 text-slate-700">
          Você ainda não tem reservas.{' '}
          <Link to="/" className="font-semibold text-teal-800 underline">
            Escolha um prestador
          </Link>
        </p>
      ) : (
        <>
          <BookingList
            id="proximas"
            title="Próximas"
            empty="Nenhuma reserva marcada."
            bookings={upcoming}
            now={now}
            onCancelled={setCancelled}
          />
          {past.length > 0 && (
            <BookingList
              id="anteriores"
              title="Anteriores e canceladas"
              bookings={past}
              now={now}
              onCancelled={setCancelled}
            />
          )}
        </>
      )}
    </section>
  );
}

function BookingList({
  id,
  title,
  empty,
  bookings,
  now,
  onCancelled,
}: {
  id: string;
  title: string;
  empty?: string;
  bookings: Booking[];
  now: number;
  onCancelled: (booking: Booking) => void;
}) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {bookings.length === 0 ? (
        <p className="mt-2 text-slate-700">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {bookings.map((booking) => (
            <BookingItem
              key={booking.id}
              booking={booking}
              now={now}
              onCancelled={onCancelled}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingItem({
  booking,
  now,
  onCancelled,
}: {
  booking: Booking;
  now: number;
  onCancelled: (booking: Booking) => void;
}) {
  const when = formatWhen(booking.startsAt, booking.timezone);
  const timeLeft = new Date(booking.startsAt).getTime() - now;
  const open = booking.status === 'CONFIRMED' && timeLeft > 0;

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">
            {booking.service.name} com {booking.provider.name}
          </h3>
          <p className="mt-0.5 text-sm text-slate-700">{when}</p>
        </div>
        <Status status={booking.status} />
      </div>
      {open &&
        (timeLeft < CANCEL_LIMIT_MS ? (
          <p className="mt-3 text-sm text-slate-700">
            Faltam menos de 2 horas para o início, e a reserva não pode mais ser
            cancelada.
          </p>
        ) : (
          <CancelControl
            booking={booking}
            when={when}
            onCancelled={onCancelled}
          />
        ))}
    </li>
  );
}

function Status({ status }: { status: Booking['status'] }) {
  return status === 'CONFIRMED' ? (
    <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
      Confirmada
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
      Cancelada
    </span>
  );
}

// Cancelar pede confirmação, porque não dá para desfazer.
function CancelControl({
  booking,
  when,
  onCancelled,
}: {
  booking: Booking;
  when: string;
  onCancelled: (booking: Booking) => void;
}) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const askButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const touched = useRef(false);

  const cancel = useMutation({
    mutationFn: () => cancelBooking(booking.id),
    onSuccess: (result) => onCancelled(result),
    onSettled: () => {
      // A lista e os horários livres do prestador mudam.
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
  });

  // Ao abrir ou fechar a pergunta, o foco vai para o botão que apareceu.
  useEffect(() => {
    if (touched.current) {
      (asking ? keepButton : askButton).current?.focus();
    }
  }, [asking]);

  const toggle = (value: boolean) => {
    touched.current = true;
    cancel.reset();
    setAsking(value);
  };

  return (
    <div className="mt-3">
      {asking ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="w-full text-sm font-medium">Cancelar esta reserva?</p>
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancel.isPending ? 'Cancelando…' : 'Sim, cancelar'}
          </button>
          <button
            ref={keepButton}
            type="button"
            disabled={cancel.isPending}
            onClick={() => toggle(false)}
            className={secondaryButton}
          >
            Manter reserva
          </button>
        </div>
      ) : (
        <button
          ref={askButton}
          type="button"
          onClick={() => toggle(true)}
          className={secondaryButton}
        >
          Cancelar reserva{' '}
          <span className="sr-only">
            de {booking.service.name}, {when}
          </span>
        </button>
      )}
      {cancel.isError && (
        <div className="mt-3">
          <FormError message={messageOf(cancel.error)} />
        </div>
      )}
    </div>
  );
}

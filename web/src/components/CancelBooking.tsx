import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { cancelBooking, type Booking } from '../api/bookings';
import { messageOf } from '../api/client';
import { SecondaryButton } from './Button';
import { FormError } from './FormError';

// Botão de cancelar reserva, usado pelo cliente e pelo prestador. Pede
// confirmação, porque não dá para desfazer. A `description` completa o nome
// do botão para o leitor de tela: "Cancelar reserva de Corte, às 09:00".
export function CancelBooking({
  booking,
  description,
  onCancelled,
}: {
  booking: Booking;
  description: string;
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
      // Mudam as reservas do cliente, a agenda e os horários livres.
      for (const key of ['bookings', 'agenda', 'slots']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
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
          <SecondaryButton
            ref={keepButton}
            type="button"
            disabled={cancel.isPending}
            onClick={() => toggle(false)}
          >
            Manter reserva
          </SecondaryButton>
        </div>
      ) : (
        <SecondaryButton
          ref={askButton}
          type="button"
          onClick={() => toggle(true)}
        >
          Cancelar reserva <span className="sr-only">{description}</span>
        </SecondaryButton>
      )}
      {cancel.isError && (
        <div className="mt-3">
          <FormError message={messageOf(cancel.error)} />
        </div>
      )}
    </div>
  );
}

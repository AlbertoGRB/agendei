import { api } from './client';

// Uma janela de atendimento: dia da semana (0 = domingo) e horas no fuso do
// prestador, em hora cheia ou meia hora.
export type AvailabilityWindow = {
  weekday: number;
  startTime: string;
  endTime: string;
};

export async function getAvailability(): Promise<AvailabilityWindow[]> {
  const { windows } = await api<{ windows: AvailabilityWindow[] }>(
    '/availability',
  );
  return windows;
}

// Salvar substitui a semana inteira (RN03).
export async function saveAvailability(
  windows: AvailabilityWindow[],
): Promise<AvailabilityWindow[]> {
  const saved = await api<{ windows: AvailabilityWindow[] }>('/availability', {
    method: 'PUT',
    body: JSON.stringify({ windows }),
  });
  return saved.windows;
}

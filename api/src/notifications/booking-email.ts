import type { NotificationType } from '../generated/prisma/client.js';
import type { BookingMessage } from './queue.js';

export type Email = { to: string; subject: string; text: string };

// Data, hora e nome do fuso, no horário do prestador.
function localTime(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'longGeneric',
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('day')}/${part('month')}/${part('year')}`,
    time: `${part('hour')}:${part('minute')}`,
    zone: part('timeZoneName'),
  };
}

// Monta o e-mail de confirmação ou de cancelamento. Função pura, sem envio.
export function bookingEmail(
  message: BookingMessage,
  type: NotificationType,
): Email {
  const { date, time, zone } = localTime(message.startsAt, message.timezone);
  const when = `${date} às ${time}`;
  const firstName = message.clientName.split(' ')[0];
  const details = [
    `Serviço: ${message.serviceName}`,
    `Com: ${message.providerName}`,
    `Quando: ${when} (${zone})`,
  ];

  if (type === 'CONFIRMATION') {
    return {
      to: message.to,
      subject: `Reserva confirmada: ${message.serviceName} em ${when}`,
      text: [
        `Olá, ${firstName}!`,
        '',
        'Sua reserva está confirmada.',
        '',
        ...details,
        '',
        'Se precisar cancelar, faça isso no agendei até 2 horas antes do horário.',
      ].join('\n'),
    };
  }

  return {
    to: message.to,
    subject: `Reserva cancelada: ${message.serviceName} em ${when}`,
    text: [
      `Olá, ${firstName}!`,
      '',
      message.cancelledBy === 'PROVIDER'
        ? 'O prestador cancelou a sua reserva.'
        : 'Sua reserva foi cancelada, como você pediu.',
      '',
      ...details,
      '',
      'O horário voltou a ficar livre. Se quiser, escolha outro no agendei.',
    ].join('\n'),
  };
}

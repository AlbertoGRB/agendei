import { Transport, type RmqOptions } from '@nestjs/microservices';
import type { Role } from '../generated/prisma/client.js';

export const NOTIFICATIONS_QUEUE = 'notifications';

// Token do cliente da fila que a API usa para publicar.
export const NOTIFICATIONS_CLIENT = Symbol('NOTIFICATIONS_CLIENT');

export const BOOKING_CREATED = 'booking.created';
export const BOOKING_CANCELLED = 'booking.cancelled';
export type BookingEvent = typeof BOOKING_CREATED | typeof BOOKING_CANCELLED;

// A mensagem já leva o que o e-mail precisa, e só isso (RNF09). Assim o
// worker não consulta as tabelas dos outros módulos.
export type BookingMessage = {
  bookingId: string;
  to: string;
  clientName: string;
  providerName: string;
  serviceName: string;
  // Início em UTC (ISO 8601) e fuso do prestador, para o e-mail mostrar a
  // hora local (ADR 0005).
  startsAt: string;
  timezone: string;
  // Só no cancelamento.
  cancelledBy?: Role;
};

// API e worker declaram a fila com os mesmos argumentos. Se forem
// diferentes, o RabbitMQ recusa a declaração.
export function rmqOptions(url: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue: NOTIFICATIONS_QUEUE,
      queueOptions: {
        durable: true,
        arguments: {
          // Fila quorum: as mensagens ficam gravadas em disco.
          'x-queue-type': 'quorum',
          // Rede de proteção: mensagem que derruba o worker 3 vezes sem
          // confirmação é descartada, em vez de voltar para sempre.
          'x-delivery-limit': 3,
        },
      },
    },
  };
}

// O worker confirma cada mensagem à mão (ack) e pega uma de cada vez.
export function workerOptions(url: string): RmqOptions {
  const { options } = rmqOptions(url);
  return {
    transport: Transport.RMQ,
    options: { ...options, noAck: false, prefetchCount: 1 },
  };
}

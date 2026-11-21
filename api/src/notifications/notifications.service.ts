import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  NOTIFICATIONS_CLIENT,
  type BookingEvent,
  type BookingMessage,
} from './queue.js';

// O cliente do RabbitMQ entrega { err, url } quando não consegue conectar, e
// um texto quando a conexão cai. A URL tem a senha e fica fora do log.
function reasonOf(error: unknown): string {
  const cause = (error as { err?: unknown } | undefined)?.err ?? error;
  if (cause instanceof Error) {
    return cause.message;
  }
  return typeof cause === 'string' ? cause : 'erro desconhecido';
}

// Lado da API: publica os eventos da reserva para o worker mandar o e-mail.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATIONS_CLIENT) private readonly queue: ClientProxy,
  ) {}

  // Não espera o RabbitMQ: a reserva já está gravada e não depende da fila
  // (RNF03). Se a publicação falhar, o erro fica no log.
  publish(event: BookingEvent, message: BookingMessage): void {
    this.queue.emit(event, message).subscribe({
      error: (error: unknown) => {
        this.logger.error(
          `Não foi possível publicar ${event} da reserva ${message.bookingId}: ${reasonOf(error)}`,
        );
      },
    });
  }
}

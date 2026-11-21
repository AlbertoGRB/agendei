import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import type { NotificationType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bookingEmail } from './booking-email.js';
import { MailerService } from './mailer.service.js';
import type { BookingMessage } from './queue.js';

const KIND: Record<NotificationType, string> = {
  CONFIRMATION: 'confirmação',
  CANCELLATION: 'cancelamento',
};

// O log não leva a mensagem do erro, que pode trazer o e-mail do cliente.
function reasonOf(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'erro desconhecido';
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? `${error.name} ${code}` : error.name;
}

// Lado do worker: manda cada e-mail uma vez só (RN12).
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  // Espera antes da 2ª e da 3ª tentativa. Os testes trocam por zero.
  retryDelays = [2_000, 10_000];

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  // Tenta até 3 vezes e depois desiste, com o erro no log. Devolver a
  // mensagem para a fila não serve: numa fila quorum, ela voltaria na hora e
  // sem limite de tentativas (ADR 0003).
  async deliver(
    message: BookingMessage,
    type: NotificationType,
  ): Promise<void> {
    const label = `e-mail de ${KIND[type]} da reserva ${message.bookingId}`;
    for (let attempt = 1; ; attempt++) {
      try {
        const sent = await this.sendOnce(message, type);
        this.logger.log(
          sent ? `${label}: enviado` : `${label}: já tinha sido enviado`,
        );
        return;
      } catch (error) {
        const delay = this.retryDelays[attempt - 1];
        if (delay === undefined) {
          this.logger.error(
            `${label}: desistiu depois de ${attempt} tentativas (${reasonOf(error)})`,
          );
          return;
        }
        this.logger.warn(
          `${label}: tentativa ${attempt} falhou (${reasonOf(error)}), nova tentativa em ${delay} ms`,
        );
        await sleep(delay);
      }
    }
  }

  // Grava o registro e envia na mesma transação, e o commit só acontece
  // depois que o servidor de e-mail aceitou. Se o envio falhar, o registro é
  // desfeito e a próxima tentativa envia. Se a mesma mensagem chegar duas
  // vezes ao mesmo tempo, a segunda espera a chave única liberar e não grava
  // nada. Devolve false quando o e-mail já tinha saído.
  private sendOnce(
    message: BookingMessage,
    type: NotificationType,
  ): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        const { count } = await tx.notification.createMany({
          data: [{ bookingId: message.bookingId, type }],
          skipDuplicates: true,
        });
        if (count === 0) {
          return false;
        }
        await this.mailer.send(bookingEmail(message, type));
        return true;
      },
      // Maior que a soma dos tempos limite do SMTP (MailerService).
      { timeout: 30_000 },
    );
  }
}

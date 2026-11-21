import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import type { NotificationType } from '../generated/prisma/client.js';
import { DeliveryService } from './delivery.service.js';
import {
  BOOKING_CANCELLED,
  BOOKING_CREATED,
  type BookingMessage,
} from './queue.js';

// Consome a fila no worker.
@Controller()
export class NotificationsController {
  constructor(private readonly delivery: DeliveryService) {}

  // O <string> escolhe a assinatura simples do decorator. A tipada só aceita
  // `unknown` depois do primeiro parâmetro, e aqui o segundo é o @Ctx().
  @EventPattern<string>(BOOKING_CREATED)
  created(@Payload() message: BookingMessage, @Ctx() context: RmqContext) {
    return this.handle(message, 'CONFIRMATION', context);
  }

  @EventPattern<string>(BOOKING_CANCELLED)
  cancelled(@Payload() message: BookingMessage, @Ctx() context: RmqContext) {
    return this.handle(message, 'CANCELLATION', context);
  }

  // A confirmação para o RabbitMQ (ack) sai só depois do envio ou da
  // desistência. Se o worker cair no meio, a mensagem é entregue de novo.
  private async handle(
    message: BookingMessage,
    type: NotificationType,
    context: RmqContext,
  ): Promise<void> {
    await this.delivery.deliver(message, type);
    const channel = context.getChannelRef() as Channel;
    channel.ack(context.getMessage() as Message);
  }
}

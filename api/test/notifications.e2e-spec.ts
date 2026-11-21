import { INestApplication, INestMicroservice } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory, type ClientProxy } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { lastValueFrom } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DeliveryService } from '../src/notifications/delivery.service.js';
import {
  BOOKING_CREATED,
  rmqOptions,
  workerOptions,
  type BookingMessage,
} from '../src/notifications/queue.js';
import { WorkerModule } from '../src/worker.module.js';
import { clearInbox, waitForEmails } from './mailpit.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

// Segunda-feira, 9h em Brasília.
const AT_9 = '2030-01-07T12:00:00.000Z';
const CARLA = 'carla@exemplo.com';

// A API, o RabbitMQ, o worker e o Mailpit de ponta a ponta.
describe('E-mails pela fila (e2e)', () => {
  let app: INestApplication<App>;
  let queue: ClientProxy;
  let worker: INestMicroservice;
  let ana: string;
  let carla: string;
  let serviceId: string;

  beforeAll(async () => {
    const workerModule = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();
    // Sem espera entre as tentativas. Mensagens que sobraram de outra
    // execução apontam para reservas que não existem mais e são descartadas
    // logo.
    workerModule.get(DeliveryService).retryDelays = [0, 0];
    const url = workerModule
      .get(ConfigService)
      .getOrThrow<string>('RABBITMQ_URL');
    worker = workerModule.createNestMicroservice(workerOptions(url));
    await worker.listen();

    queue = ClientProxyFactory.create(rmqOptions(url));
    app = await createTestApp({ queue });
  });

  beforeEach(async () => {
    await resetDatabase(app);
    await clearInbox();
    const user = (name: string, email: string, role: string) =>
      registerAndLogin(app, { name, email, password: 'senha-forte-123', role });
    ana = await user('Ana Souza', 'ana@exemplo.com', 'PROVIDER');
    carla = await user('Carla Dias', CARLA, 'CLIENT');
    serviceId = (
      await as(ana)
        .post('/services')
        .send({ name: 'Corte', durationMinutes: 60, priceCents: 5000 })
    ).body.id;
    await as(ana)
      .put('/availability')
      .send({
        windows: [{ weekday: 1, startTime: '09:00', endTime: '12:00' }],
      });
  });

  afterAll(async () => {
    await app.close();
    await queue.close();
    await worker.close();
  });

  function as(token: string, target = app) {
    const server = target.getHttpServer();
    const auth = { Authorization: `Bearer ${token}` };
    return {
      get: (path: string) => request(server).get(path).set(auth),
      post: (path: string) => request(server).post(path).set(auth),
      put: (path: string) => request(server).put(path).set(auth),
    };
  }

  const book = () =>
    as(carla).post('/bookings').send({ serviceId, startsAt: AT_9 });

  it('reservar manda o e-mail de confirmação para o cliente (RF14)', async () => {
    expect((await book()).status).toBe(201);

    const [email] = await waitForEmails(CARLA, 1);

    expect(email.subject).toBe(
      'Reserva confirmada: Corte em 07/01/2030 às 09:00',
    );
    expect(email.text).toContain('Olá, Carla!');
    expect(email.text).toContain('Com: Ana Souza');
  });

  it('o cliente cancela e recebe o e-mail de cancelamento (RF15)', async () => {
    const { body: booking } = await book();

    const response = await as(carla).post(`/bookings/${booking.id}/cancel`);

    expect(response.status).toBe(200);
    const emails = await waitForEmails(CARLA, 2);
    expect(emails.map((email) => email.subject)).toEqual([
      'Reserva confirmada: Corte em 07/01/2030 às 09:00',
      'Reserva cancelada: Corte em 07/01/2030 às 09:00',
    ]);
    expect(emails[1].text).toContain(
      'Sua reserva foi cancelada, como você pediu.',
    );
  });

  it('o prestador cancela e o cliente recebe o aviso (US08)', async () => {
    const { body: booking } = await book();

    const response = await as(ana).post(`/bookings/${booking.id}/cancel`);

    expect(response.status).toBe(200);
    const emails = await waitForEmails(CARLA, 2);
    expect(emails[1].subject).toBe(
      'Reserva cancelada: Corte em 07/01/2030 às 09:00',
    );
    expect(emails[1].text).toContain('O prestador cancelou a sua reserva.');
  });

  it('a mesma mensagem entregue de novo não vira outro e-mail (RN12)', async () => {
    const { body: booking } = await book();
    // Duas cópias da mensagem da reserva, como numa reentrega do RabbitMQ.
    const copy: BookingMessage = {
      bookingId: booking.id,
      to: CARLA,
      clientName: 'Carla Dias',
      providerName: 'Ana Souza',
      serviceName: 'Corte',
      startsAt: AT_9,
      timezone: 'America/Sao_Paulo',
    };
    for (let i = 0; i < 2; i++) {
      await lastValueFrom(queue.emit(BOOKING_CREATED, copy), {
        defaultValue: undefined,
      });
    }
    // O cancelamento entra na fila depois das cópias. Quando o e-mail dele
    // chega, o worker já passou por todas elas.
    await as(carla).post(`/bookings/${booking.id}/cancel`);

    const emails = await waitForEmails(CARLA, 2);

    expect(emails.map((email) => email.subject)).toEqual([
      'Reserva confirmada: Corte em 07/01/2030 às 09:00',
      'Reserva cancelada: Corte em 07/01/2030 às 09:00',
    ]);
  });

  it('com o RabbitMQ fora do ar, a reserva é gravada mesmo assim (RNF03)', async () => {
    // Porta onde não há nada escutando.
    const offlineQueue = ClientProxyFactory.create(
      rmqOptions('amqp://agendei:agendei@127.0.0.1:1'),
    );
    const offlineApp = await createTestApp({ queue: offlineQueue });
    try {
      const response = await as(carla, offlineApp)
        .post('/bookings')
        .send({ serviceId, startsAt: AT_9 });

      expect(response.status).toBe(201);
      const { body } = await as(carla, offlineApp).get('/bookings');
      expect(body).toHaveLength(1);
    } finally {
      await offlineApp.close();
      await offlineQueue.close();
    }
  });
});

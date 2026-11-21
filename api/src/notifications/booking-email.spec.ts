import { bookingEmail } from './booking-email.js';
import type { BookingMessage } from './queue.js';

const message: BookingMessage = {
  bookingId: 'reserva-1',
  to: 'carla@exemplo.com',
  clientName: 'Carla Dias',
  providerName: 'Ana Souza',
  serviceName: 'Corte',
  // 9h em Brasília
  startsAt: '2030-01-07T12:00:00.000Z',
  timezone: 'America/Sao_Paulo',
};

describe('bookingEmail', () => {
  it('confirmação: para o cliente, com serviço, prestador e hora local', () => {
    const email = bookingEmail(message, 'CONFIRMATION');

    expect(email.to).toBe('carla@exemplo.com');
    expect(email.subject).toBe(
      'Reserva confirmada: Corte em 07/01/2030 às 09:00',
    );
    expect(email.text).toContain('Olá, Carla!');
    expect(email.text).toContain('Sua reserva está confirmada.');
    expect(email.text).toContain('Serviço: Corte');
    expect(email.text).toContain('Com: Ana Souza');
    expect(email.text).toContain(
      'Quando: 07/01/2030 às 09:00 (Horário Padrão de Brasília)',
    );
  });

  it('usa o fuso do prestador, não o do servidor', () => {
    const email = bookingEmail(
      { ...message, timezone: 'America/Manaus' },
      'CONFIRMATION',
    );

    expect(email.subject).toBe(
      'Reserva confirmada: Corte em 07/01/2030 às 08:00',
    );
    expect(email.text).toContain('(Horário Padrão do Amazonas)');
  });

  it('a data vem do fuso: 23h30 em Brasília ainda é o mesmo dia', () => {
    const email = bookingEmail(
      { ...message, startsAt: '2030-01-08T02:30:00.000Z' },
      'CONFIRMATION',
    );

    expect(email.subject).toBe(
      'Reserva confirmada: Corte em 07/01/2030 às 23:30',
    );
  });

  it('cancelamento pelo cliente', () => {
    const email = bookingEmail(
      { ...message, cancelledBy: 'CLIENT' },
      'CANCELLATION',
    );

    expect(email.subject).toBe(
      'Reserva cancelada: Corte em 07/01/2030 às 09:00',
    );
    expect(email.text).toContain('Sua reserva foi cancelada, como você pediu.');
    expect(email.text).toContain('O horário voltou a ficar livre.');
  });

  it('cancelamento pelo prestador avisa quem cancelou', () => {
    const email = bookingEmail(
      { ...message, cancelledBy: 'PROVIDER' },
      'CANCELLATION',
    );

    expect(email.text).toContain('O prestador cancelou a sua reserva.');
  });

  it('não leva o e-mail nem o id de ninguém no texto (RNF09)', () => {
    for (const type of ['CONFIRMATION', 'CANCELLATION'] as const) {
      const email = bookingEmail(message, type);
      expect(email.text).not.toContain('@');
      expect(email.text).not.toContain('reserva-1');
    }
  });
});

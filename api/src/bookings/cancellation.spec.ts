import { cancellationProblem } from './cancellation.js';

const NOW = new Date('2030-01-07T12:00:00.000Z');
const inMinutes = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000);
const confirmed = (minutes: number) => ({
  status: 'CONFIRMED' as const,
  startsAt: inMinutes(minutes),
});

describe('cancellationProblem', () => {
  describe('cliente', () => {
    it('cancela com mais de 2 horas de antecedência', () => {
      expect(cancellationProblem(confirmed(180), 'CLIENT', NOW)).toBeNull();
    });

    it('cancela com exatamente 2 horas de antecedência', () => {
      expect(cancellationProblem(confirmed(120), 'CLIENT', NOW)).toBeNull();
    });

    it('não cancela com menos de 2 horas', () => {
      expect(cancellationProblem(confirmed(119), 'CLIENT', NOW)).toBe(
        'O cliente só cancela até 2 horas antes do início',
      );
    });
  });

  describe('prestador', () => {
    it('cancela até um minuto antes do início', () => {
      expect(cancellationProblem(confirmed(1), 'PROVIDER', NOW)).toBeNull();
    });

    it('não cancela a reserva que já começou', () => {
      expect(cancellationProblem(confirmed(0), 'PROVIDER', NOW)).toBe(
        'Essa reserva já começou',
      );
      expect(cancellationProblem(confirmed(-30), 'PROVIDER', NOW)).toBe(
        'Essa reserva já começou',
      );
    });
  });

  it('a reserva que já começou também não é cancelada pelo cliente', () => {
    expect(cancellationProblem(confirmed(-30), 'CLIENT', NOW)).toBe(
      'Essa reserva já começou',
    );
  });

  it('ninguém cancela de novo uma reserva cancelada', () => {
    const cancelled = {
      status: 'CANCELLED' as const,
      startsAt: inMinutes(600),
    };

    expect(cancellationProblem(cancelled, 'CLIENT', NOW)).toBe(
      'Essa reserva já foi cancelada',
    );
    expect(cancellationProblem(cancelled, 'PROVIDER', NOW)).toBe(
      'Essa reserva já foi cancelada',
    );
  });
});

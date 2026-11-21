import { screen, waitFor, within } from '@testing-library/react';
import type { Booking } from '../api/bookings';
import { setAccessToken } from '../api/client';
import { fakeApi, reply } from '../test/fake-api';
import { renderApp } from '../test/render-app';

const anaSession = {
  'POST /api/auth/refresh': () => reply(200, { accessToken: 'token-da-ana' }),
  'GET /api/users/me': () =>
    reply(200, {
      id: 'p1',
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      role: 'PROVIDER',
      timezone: 'America/Sao_Paulo',
    }),
};

function booking(
  id: string,
  service: string,
  client: string,
  startsAt: string,
  endsAt: string,
): Booking {
  return {
    id,
    status: 'CONFIRMED',
    startsAt,
    endsAt,
    cancelledAt: null,
    timezone: 'America/Sao_Paulo',
    service: {
      id: `s-${id}`,
      name: service,
      durationMinutes: 60,
      priceCents: 5000,
    },
    provider: { id: 'p1', name: 'Ana Souza' },
    client: { id: `c-${id}`, name: client },
  };
}

// Segunda-feira, 7 de janeiro de 2030, em Brasília (UTC-3).
const EARLY = booking(
  'b0',
  'Corte',
  'Eva Lima',
  '2030-01-07T10:00:00.000Z',
  '2030-01-07T11:00:00.000Z',
);
const NINE = booking(
  'b1',
  'Corte',
  'Carla Dias',
  '2030-01-07T12:00:00.000Z',
  '2030-01-07T13:00:00.000Z',
);
const TWO = booking(
  'b2',
  'Barba',
  'Davi Rocha',
  '2030-01-07T17:00:00.000Z',
  '2030-01-07T17:30:00.000Z',
);

const agenda = (date: string, bookings: Booking[]) =>
  reply(200, { date, timezone: 'America/Sao_Paulo', bookings });

const MONDAY = 'GET /api/agenda?date=2030-01-07';
const TUESDAY = 'GET /api/agenda?date=2030-01-08';

beforeEach(() => {
  setAccessToken(null);
  vi.useFakeTimers({ toFake: ['Date'] });
  // 8h30 em Brasília: a reserva das 7h já começou.
  vi.setSystemTime(new Date('2030-01-07T11:30:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('agenda do prestador', () => {
  it('mostra as reservas do dia em ordem, com horário, serviço e cliente (RF06)', async () => {
    fakeApi({
      ...anaSession,
      [MONDAY]: () => agenda('2030-01-07', [EARLY, NINE, TWO]),
    });
    renderApp('/');

    expect(
      await screen.findByRole('heading', {
        name: 'Agenda de segunda-feira, 7 de janeiro',
      }),
    ).toBeInTheDocument();
    const times = (await screen.findAllByRole('heading', { level: 3 })).map(
      (h) => h.textContent,
    );
    expect(times).toEqual([
      '07:00 às 08:00',
      '09:00 às 10:00',
      '14:00 às 14:30',
    ]);
    expect(screen.getByText('Corte com Carla Dias')).toBeInTheDocument();
    expect(
      screen.getByText('Horários em Horário Padrão de Brasília.'),
    ).toBeInTheDocument();
  });

  it('abre no dia de hoje do fuso do prestador, mesmo perto da meia-noite (RN13)', async () => {
    // 23h30 de segunda em Brasília já é terça em UTC.
    vi.setSystemTime(new Date('2030-01-08T02:30:00.000Z'));
    const server = fakeApi({
      ...anaSession,
      [MONDAY]: () => agenda('2030-01-07', []),
    });
    renderApp('/');

    expect(
      await screen.findByText('Nenhuma reserva neste dia.'),
    ).toBeInTheDocument();
    expect(server.calls().join('\n')).toContain('/api/agenda?date=2030-01-07');
  });

  it('passa para o dia seguinte e volta para hoje', async () => {
    fakeApi({
      ...anaSession,
      [MONDAY]: () => agenda('2030-01-07', [NINE]),
      [TUESDAY]: () => agenda('2030-01-08', []),
    });
    const user = renderApp('/');

    await user.click(
      await screen.findByRole('button', { name: 'Próximo dia' }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Agenda de terça-feira, 8 de janeiro',
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Nenhuma reserva neste dia.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Dia')).toHaveValue('2030-01-08');

    await user.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(await screen.findByText('Corte com Carla Dias')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Hoje' }),
    ).not.toBeInTheDocument();
  });

  it('cancela uma reserva que ainda não começou, e ela sai da agenda (RF12)', async () => {
    let cancelled = false;
    fakeApi({
      ...anaSession,
      [MONDAY]: () =>
        agenda('2030-01-07', cancelled ? [EARLY, TWO] : [EARLY, NINE, TWO]),
      'POST /api/bookings/b1/cancel': () => {
        cancelled = true;
        return reply(200, { ...NINE, status: 'CANCELLED' });
      },
    });
    const user = renderApp('/');

    await user.click(
      await screen.findByRole('button', {
        name: 'Cancelar reserva de Carla Dias, às 09:00',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }));

    expect(
      await screen.findByText(
        'Reserva cancelada: Corte com Carla Dias, às 09:00. O cliente vai receber um e-mail com o cancelamento.',
      ),
    ).toHaveFocus();
    await waitFor(() =>
      expect(
        screen.queryByText('Corte com Carla Dias'),
      ).not.toBeInTheDocument(),
    );
  });

  it('a reserva que já começou não tem botão de cancelar', async () => {
    fakeApi({
      ...anaSession,
      [MONDAY]: () => agenda('2030-01-07', [EARLY, NINE]),
    });
    renderApp('/');

    const early = (
      await screen.findByRole('heading', { name: '07:00 às 08:00' })
    ).closest('li')!;
    expect(within(early).queryByRole('button')).not.toBeInTheDocument();
    const nine = screen
      .getByRole('heading', { name: '09:00 às 10:00' })
      .closest('li')!;
    expect(
      within(nine).getByRole('button', { name: /^Cancelar reserva/ }),
    ).toBeInTheDocument();
  });

  it('o topo leva às páginas do prestador', async () => {
    fakeApi({ ...anaSession, [MONDAY]: () => agenda('2030-01-07', []) });
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Agenda', 'Serviços', 'Horários']);
    expect(within(nav).getByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

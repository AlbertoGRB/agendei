import { screen, waitFor, within } from '@testing-library/react';
import type { Booking } from '../api/bookings';
import { setAccessToken } from '../api/client';
import { fakeApi, reply } from '../test/fake-api';
import { renderApp } from '../test/render-app';

// Agora: segunda-feira, 7 de janeiro de 2030, 8h em Brasília.
const NOW = '2030-01-07T11:00:00.000Z';

const carlaSession = {
  'POST /api/auth/refresh': () => reply(200, { accessToken: 'token-da-carla' }),
  'GET /api/users/me': () =>
    reply(200, {
      id: 'c1',
      name: 'Carla Dias',
      email: 'carla@exemplo.com',
      role: 'CLIENT',
      timezone: 'America/Sao_Paulo',
    }),
};

function booking(
  id: string,
  service: string,
  startsAt: string,
  extra: Partial<Booking> = {},
): Booking {
  return {
    id,
    status: 'CONFIRMED',
    startsAt,
    endsAt: startsAt,
    cancelledAt: null,
    timezone: 'America/Sao_Paulo',
    service: {
      id: `s-${id}`,
      name: service,
      durationMinutes: 60,
      priceCents: 5000,
    },
    provider: { id: 'p1', name: 'Ana Souza' },
    client: { id: 'c1', name: 'Carla Dias' },
    ...extra,
  };
}

// Amanhã às 9h: dá para cancelar.
const TOMORROW = booking('b1', 'Corte', '2030-01-08T12:00:00.000Z');
// Hoje às 9h, daqui a 1 hora: não dá mais para cancelar (RN08).
const SOON = booking('b2', 'Barba', '2030-01-07T12:00:00.000Z');
// Cancelada na semana passada, com outro prestador.
const OLD = booking('b3', 'Corte e barba', '2030-01-03T13:00:00.000Z', {
  status: 'CANCELLED',
  cancelledAt: '2030-01-02T10:00:00.000Z',
  provider: { id: 'p2', name: 'Bruno Lima' },
});

// A API devolve da mais nova para a mais antiga.
const ALL = [TOMORROW, SOON, OLD];

const CANCEL_TOMORROW =
  'Cancelar reserva de Corte, terça-feira, 8 de janeiro, às 09:00';

function itemOf(title: string): HTMLElement {
  return screen.getByRole('heading', { name: title }).closest('li')!;
}

beforeEach(() => {
  setAccessToken(null);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('minhas reservas', () => {
  it('mostra as próximas, da mais perto para a mais longe, e as anteriores, com o status (RF10)', async () => {
    fakeApi({ ...carlaSession, 'GET /api/bookings': () => reply(200, ALL) });
    renderApp('/reservas');

    const upcoming = await screen.findByRole('region', { name: 'Próximas' });
    const titles = within(upcoming)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(['Barba com Ana Souza', 'Corte com Ana Souza']);
    expect(itemOf('Corte com Ana Souza')).toHaveTextContent(
      'terça-feira, 8 de janeiro, às 09:00',
    );
    expect(itemOf('Corte com Ana Souza')).toHaveTextContent('Confirmada');

    const past = screen.getByRole('region', {
      name: 'Anteriores e canceladas',
    });
    expect(within(past).getByRole('listitem')).toHaveTextContent(
      'Corte e barba com Bruno Lima',
    );
    expect(within(past).getByRole('listitem')).toHaveTextContent('Cancelada');
  });

  it('cancela com mais de 2 horas de antecedência, e a reserva muda de lista (RF11)', async () => {
    let cancelled = false;
    const done = {
      ...TOMORROW,
      status: 'CANCELLED' as const,
      cancelledAt: NOW,
    };
    fakeApi({
      ...carlaSession,
      'GET /api/bookings': () =>
        reply(200, cancelled ? [done, SOON, OLD] : ALL),
      'POST /api/bookings/b1/cancel': () => {
        cancelled = true;
        return reply(200, done);
      },
    });
    const user = renderApp('/reservas');

    await user.click(
      await screen.findByRole('button', { name: CANCEL_TOMORROW }),
    );
    expect(screen.getByText('Cancelar esta reserva?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }));

    expect(
      await screen.findByText(
        /^Reserva cancelada: Corte com Ana Souza, terça-feira, 8 de janeiro, às 09:00\./,
      ),
    ).toHaveFocus();
    await waitFor(() =>
      expect(
        within(
          screen.getByRole('region', { name: 'Anteriores e canceladas' }),
        ).getByRole('heading', { name: 'Corte com Ana Souza' }),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole('region', { name: 'Próximas' })).queryByRole(
        'heading',
        { name: 'Corte com Ana Souza' },
      ),
    ).not.toBeInTheDocument();
  });

  it('a menos de 2 horas do início, explica que não dá mais para cancelar (RN08)', async () => {
    fakeApi({ ...carlaSession, 'GET /api/bookings': () => reply(200, ALL) });
    renderApp('/reservas');

    await screen.findByRole('region', { name: 'Próximas' });
    const soon = itemOf('Barba com Ana Souza');
    expect(soon).toHaveTextContent(
      'Faltam menos de 2 horas para o início, e a reserva não pode mais ser cancelada.',
    );
    expect(within(soon).queryByRole('button')).not.toBeInTheDocument();
    expect(
      within(itemOf('Corte e barba com Bruno Lima')).queryByRole('button'),
    ).not.toBeInTheDocument();
  });

  it('a API recusa o cancelamento: mostra o motivo dela', async () => {
    fakeApi({
      ...carlaSession,
      'GET /api/bookings': () => reply(200, ALL),
      'POST /api/bookings/b1/cancel': () =>
        reply(409, {
          message: 'O cliente só cancela até 2 horas antes do início',
        }),
    });
    const user = renderApp('/reservas');

    await user.click(
      await screen.findByRole('button', { name: CANCEL_TOMORROW }),
    );
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O cliente só cancela até 2 horas antes do início',
    );
  });

  it('"Manter reserva" desiste sem chamar a API e devolve o foco (RNF06)', async () => {
    const server = fakeApi({
      ...carlaSession,
      'GET /api/bookings': () => reply(200, ALL),
    });
    const user = renderApp('/reservas');

    (await screen.findByRole('button', { name: CANCEL_TOMORROW })).focus();
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('button', { name: 'Manter reserva' }),
    ).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: CANCEL_TOMORROW })).toHaveFocus();
    expect(server.calls().join('\n')).not.toContain('/cancel');
  });

  it('sem reservas, aponta para a lista de prestadores', async () => {
    fakeApi({ ...carlaSession, 'GET /api/bookings': () => reply(200, []) });
    renderApp('/reservas');

    expect(
      await screen.findByText('Você ainda não tem reservas.', { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Escolha um prestador' }),
    ).toHaveAttribute('href', '/');
  });

  it('o cliente chega pelo link do topo', async () => {
    fakeApi({
      ...carlaSession,
      'GET /api/providers': () => reply(200, []),
      'GET /api/bookings': () => reply(200, ALL),
    });
    const user = renderApp('/');

    await user.click(
      await screen.findByRole('link', { name: 'Minhas reservas' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Minhas reservas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Minhas reservas' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('o prestador não vê o link e volta para o início', async () => {
    const server = fakeApi({
      'POST /api/auth/refresh': () =>
        reply(200, { accessToken: 'token-da-ana' }),
      'GET /api/users/me': () =>
        reply(200, { id: 'p1', name: 'Ana Souza', role: 'PROVIDER' }),
    });
    renderApp('/reservas');

    expect(
      await screen.findByRole('heading', { name: 'Olá, Ana' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Minhas reservas' }),
    ).not.toBeInTheDocument();
    expect(server.calls().join('\n')).not.toContain('/api/bookings');
  });
});

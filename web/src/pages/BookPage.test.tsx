import { screen, waitFor, within } from '@testing-library/react';
import { setAccessToken } from '../api/client';
import { fakeApi, reply } from '../test/fake-api';
import { renderApp } from '../test/render-app';

// Segunda-feira, 7 de janeiro de 2030: 9h e 9h30 em Brasília.
const AT_9 = '2030-01-07T12:00:00.000Z';
const AT_930 = '2030-01-07T12:30:00.000Z';
const SLOTS = 'GET /api/providers/p1/slots?serviceId=s1&date=2030-01-07';

const ANA = {
  id: 'p1',
  name: 'Ana Souza',
  services: [
    { id: 's1', name: 'Corte', durationMinutes: 60, priceCents: 5000 },
    { id: 's2', name: 'Barba', durationMinutes: 30, priceCents: 3000 },
  ],
};

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
  'GET /api/providers/p1': () => reply(200, ANA),
};

const slots = (list: string[], timezone = 'America/Sao_Paulo') =>
  reply(200, { date: '2030-01-07', timezone, slots: list });

const confirmed = {
  id: 'b1',
  status: 'CONFIRMED',
  startsAt: AT_9,
  endsAt: '2030-01-07T13:00:00.000Z',
  cancelledAt: null,
  timezone: 'America/Sao_Paulo',
  service: { id: 's1', name: 'Corte', durationMinutes: 60, priceCents: 5000 },
  provider: { id: 'p1', name: 'Ana Souza' },
  client: { id: 'c1', name: 'Carla Dias' },
};

beforeEach(() => {
  setAccessToken(null);
  // Só o relógio é falso: a lista de dias começa sempre no mesmo dia.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2030, 0, 7, 8));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reservar um horário', () => {
  it('o início lista os prestadores com os serviços (RF07)', async () => {
    fakeApi({ ...carlaSession, 'GET /api/providers': () => reply(200, [ANA]) });
    const user = renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Ana Souza' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Corte · 1 h · R\$\s50,00/)).toBeInTheDocument();
    expect(screen.getByText(/Barba · 30 min · R\$\s30,00/)).toBeInTheDocument();

    await user.click(
      screen.getByRole('link', { name: 'Ver horários de Ana Souza' }),
    );

    expect(
      await screen.findByRole('radio', { name: /Corte/ }),
    ).toBeInTheDocument();
  });

  it('reserva em 4 passos: serviço, dia, horário e confirmar (US06)', async () => {
    let sent: unknown;
    fakeApi({
      ...carlaSession,
      [SLOTS]: () => slots([AT_9, AT_930]),
      'POST /api/bookings': ({ body }) => {
        sent = body;
        return reply(201, confirmed);
      },
    });
    const user = renderApp('/prestadores/p1');

    await user.click(await screen.findByRole('radio', { name: /Corte/ }));
    await user.click(
      screen.getByRole('radio', { name: 'segunda-feira, 7 de janeiro' }),
    );
    await user.click(await screen.findByRole('radio', { name: '09:00' }));
    expect(
      screen.getByText('segunda-feira, 7 de janeiro, às 09:00'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(
      await screen.findByRole('heading', { name: 'Reserva confirmada' }),
    ).toHaveFocus();
    expect(
      screen.getByText(
        'Corte com Ana Souza, segunda-feira, 7 de janeiro, às 09:00.',
      ),
    ).toBeInTheDocument();
    expect(sent).toEqual({ serviceId: 's1', startsAt: AT_9 });
  });

  it('dia sem atendimento mostra "Sem horários" e nenhuma lista (US05)', async () => {
    fakeApi({ ...carlaSession, [SLOTS]: () => slots([]) });
    const user = renderApp('/prestadores/p1');

    await user.click(await screen.findByRole('radio', { name: /Corte/ }));
    await user.click(
      screen.getByRole('radio', { name: 'segunda-feira, 7 de janeiro' }),
    );

    const group = screen.getByRole('group', { name: 'Horário' });
    expect(
      await within(group).findByText('Sem horários neste dia.'),
    ).toBeInTheDocument();
    expect(within(group).queryAllByRole('radio')).toHaveLength(0);
  });

  it('horário que acabou de ser reservado: avisa e mostra os que sobraram (409)', async () => {
    let calls = 0;
    fakeApi({
      ...carlaSession,
      // Na segunda busca, as 9h já foram de outro cliente.
      [SLOTS]: () => slots(++calls === 1 ? [AT_9, AT_930] : [AT_930]),
      'POST /api/bookings': () =>
        reply(409, { message: 'Esse horário acabou de ser reservado' }),
    });
    const user = renderApp('/prestadores/p1');

    await user.click(await screen.findByRole('radio', { name: /Corte/ }));
    await user.click(
      screen.getByRole('radio', { name: 'segunda-feira, 7 de janeiro' }),
    );
    await user.click(await screen.findByRole('radio', { name: '09:00' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esse horário acabou de ser reservado. Escolha outro.',
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('radio', { name: '09:00' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('radio', { name: '09:30' })).not.toBeChecked();
    expect(
      screen.queryByRole('button', { name: 'Confirmar reserva' }),
    ).not.toBeInTheDocument();
  });

  it('mostra os horários no fuso do prestador', async () => {
    fakeApi({
      ...carlaSession,
      // 13h em UTC são 9h em Manaus.
      [SLOTS]: () => slots(['2030-01-07T13:00:00.000Z'], 'America/Manaus'),
    });
    const user = renderApp('/prestadores/p1');

    await user.click(await screen.findByRole('radio', { name: /Corte/ }));
    await user.click(
      screen.getByRole('radio', { name: 'segunda-feira, 7 de janeiro' }),
    );

    expect(
      await screen.findByRole('radio', { name: '09:00' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Horários em Horário Padrão do Amazonas.'),
    ).toBeInTheDocument();
  });

  it('as escolhas funcionam pelo teclado (RNF06)', async () => {
    fakeApi(carlaSession);
    const user = renderApp('/prestadores/p1');

    (await screen.findByRole('radio', { name: /Corte/ })).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: /Corte/ })).toBeChecked();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: /Barba/ })).toBeChecked();
  });

  it('prestador que não existe mostra a mensagem da API', async () => {
    fakeApi({
      ...carlaSession,
      'GET /api/providers/p1': () =>
        reply(404, { message: 'Prestador não encontrado' }),
    });
    renderApp('/prestadores/p1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Prestador não encontrado',
    );
  });

  it('a página de reserva é só para cliente', async () => {
    const server = fakeApi({
      'POST /api/auth/refresh': () =>
        reply(200, { accessToken: 'token-da-ana' }),
      'GET /api/users/me': () =>
        reply(200, { id: 'p1', name: 'Ana Souza', role: 'PROVIDER' }),
    });
    renderApp('/prestadores/p1');

    expect(
      await screen.findByRole('heading', { name: 'Olá, Ana' }),
    ).toBeInTheDocument();
    expect(server.calls().join('\n')).not.toContain('/api/providers');
  });
});

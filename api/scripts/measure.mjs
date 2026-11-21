// Mede o tempo de resposta das duas rotas do RNF01, com a API já rodando:
//   npm run measure                      (http://localhost:3000)
//   npm run measure -- http://outra:3000
//
// Cria um prestador e um cliente novos a cada rodada (e-mails aleatórios em
// example.com), com um serviço de 30 minutos e atendimento das 8h às 20h todos
// os dias. Depois mede a rota de horários livres e a de reserva, uma chamada
// por vez, e imprime a tabela do README. Os dados ficam no banco.

const BASE = process.argv[2] ?? 'http://localhost:3000';
const SLOTS_SAMPLES = 300;
const BOOKING_SAMPLES = 100;
// A rota de reserva aceita 30 chamadas por minuto de cada IP. Uma a cada 2,1 s
// fica abaixo disso.
const BOOKING_INTERVAL_MS = 2100;
const TIMEZONE = 'America/Sao_Paulo';

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function account(role) {
  const user = {
    name: role === 'PROVIDER' ? 'Prestador da medição' : 'Cliente da medição',
    email: `medicao-${role.toLowerCase()}-${crypto.randomUUID()}@example.com`,
    password: crypto.randomUUID(),
    role,
    timezone: TIMEZONE,
  };
  await call('POST', '/auth/register', { body: user });
  const { accessToken } = await call('POST', '/auth/login', {
    body: { email: user.email, password: user.password },
  });
  return accessToken;
}

// Tempo de uma chamada, em milissegundos, do envio ao fim da resposta.
async function timed(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function percentile(sorted, p) {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function row(name, samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const ms = (value) =>
    `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ms`;
  return `| ${name} | ${sorted.length} | ${ms(percentile(sorted, 50))} | ${ms(percentile(sorted, 95))} | ${ms(sorted.at(-1))} |`;
}

function addDays(date, amount) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount))
    .toISOString()
    .slice(0, 10);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const provider = await account('PROVIDER');
const client = await account('CLIENT');
const providerId = (await call('GET', '/users/me', { token: provider })).id;
const service = await call('POST', '/services', {
  token: provider,
  body: { name: 'Medição', durationMinutes: 30, priceCents: 1000 },
});
await call('PUT', '/availability', {
  token: provider,
  body: {
    windows: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      startTime: '08:00',
      endTime: '20:00',
    })),
  },
});

// Começa daqui a dois dias, longe de qualquer virada de dia do fuso.
const firstDay = addDays(new Date().toISOString().slice(0, 10), 2);
const slotsPath = (date) =>
  `/providers/${providerId}/slots?date=${date}&serviceId=${service.id}`;

// Aquecimento: as primeiras chamadas abrem conexões e compilam o código.
for (let i = 0; i < 20; i++) {
  await call('GET', slotsPath(firstDay), { token: client });
}

console.log(`Medindo ${SLOTS_SAMPLES} chamadas de horários livres...`);
const slotsTimes = [];
for (let i = 0; i < SLOTS_SAMPLES; i++) {
  const date = addDays(firstDay, i % 30);
  slotsTimes.push(
    await timed(() => call('GET', slotsPath(date), { token: client })),
  );
}

console.log(
  `Medindo ${BOOKING_SAMPLES} reservas, uma a cada ${(BOOKING_INTERVAL_MS / 1000).toLocaleString('pt-BR')} s...`,
);
// Cada reserva pega o primeiro horário livre do dia, e o dia muda quando acaba.
const bookingTimes = [];
let day = firstDay;
let free = [];
for (let i = 0; i < BOOKING_SAMPLES; i++) {
  while (free.length === 0) {
    free = (await call('GET', slotsPath(day), { token: client })).slots;
    if (free.length === 0) {
      day = addDays(day, 1);
    }
  }
  const startsAt = free.shift();
  const started = performance.now();
  bookingTimes.push(
    await timed(() =>
      call('POST', '/bookings', {
        token: client,
        body: { serviceId: service.id, startsAt },
      }),
    ),
  );
  const elapsed = performance.now() - started;
  await sleep(Math.max(0, BOOKING_INTERVAL_MS - elapsed));
}

console.log('');
console.log('| Rota | Chamadas | Mediana | p95 | Máximo |');
console.log('| --- | --- | --- | --- | --- |');
console.log(row('`GET /providers/:id/slots`', slotsTimes));
console.log(row('`POST /bookings`', bookingTimes));

// Lê a caixa de entrada do Mailpit, que recebe os e-mails do worker nos testes.
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export type ReceivedEmail = {
  to: string[];
  subject: string;
  text: string;
};

type MessageSummary = {
  ID: string;
  Subject: string;
  To: { Address: string }[];
};

export async function clearInbox(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
}

// Espera chegarem `count` e-mails para o endereço, por até `timeoutMs`.
export async function waitForEmails(
  to: string,
  count: number,
  timeoutMs = 10_000,
): Promise<ReceivedEmail[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const { messages } = (await response.json()) as {
      messages: MessageSummary[];
    };
    const mine = messages.filter((m) => m.To.some((t) => t.Address === to));
    if (mine.length >= count || Date.now() > deadline) {
      // A lista vem da mais nova para a mais antiga.
      return Promise.all(mine.reverse().map((m) => read(m)));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function read(summary: MessageSummary): Promise<ReceivedEmail> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`);
  const { Text } = (await response.json()) as { Text: string };
  return {
    to: summary.To.map((t) => t.Address),
    subject: summary.Subject,
    text: Text,
  };
}

import {
  api,
  hasAccessToken,
  post,
  refreshSession,
  setAccessToken,
} from './client';

export type Role = 'PROVIDER' | 'CLIENT';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
};

export type NewAccount = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

export async function login(email: string, password: string): Promise<void> {
  const { accessToken } = await api<{ accessToken: string }>(
    '/auth/login',
    post({ email, password }),
  );
  setAccessToken(accessToken);
}

// O cadastro só cria a conta. Para abrir a sessão, entra em seguida.
export async function register(account: NewAccount): Promise<void> {
  await api('/auth/register', post(account));
  await login(account.email, account.password);
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', post());
  } finally {
    setAccessToken(null);
  }
}

// Quem está usando o front. Ao abrir a página não há token em memória, então
// tenta recuperar a sessão pelo cookie antes de desistir.
export async function currentUser(): Promise<User | null> {
  if (!hasAccessToken() && !(await refreshSession())) {
    return null;
  }
  return api<User>('/users/me');
}

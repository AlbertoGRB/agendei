import { timingSafeEqual } from 'node:crypto';
import {
  normalizeIp,
  type ThrottlerGetTrackerFunction,
} from '@nestjs/throttler';
import type { Request } from 'express';

// A Vercel grava os dois cabeçalhos em toda chamada que repassa para a API
// (web/vercel.json): o segredo de ORIGIN_SECRET e o IP do cliente, copiado do
// x-forwarded-for que ela mesma monta. O `set` troca o que o visitante mandar.
export const ORIGIN_SECRET_HEADER = 'x-origin-secret';
export const CLIENT_IP_HEADER = 'x-agendei-client-ip';

// Define de quem é cada chamada no limite de requisições.
//
// Pela Vercel, a chamada chega ao Railway de um IP de saída da Vercel, que muda
// a cada chamada. O IP do cliente vem no x-agendei-client-ip, que só vale com o
// segredo certo: sem ele, qualquer um mandaria um IP inventado a cada tentativa
// e nunca chegaria ao limite.
//
// O x-vercel-forwarded-for não serve para isso. O teste em produção mostrou que
// a Vercel às vezes repassa o valor que o visitante mandou nele.
//
// Sem o segredo, conta o IP que chegou ao Railway (req.ip, com TRUST_PROXY).
export function clientIpTracker(
  originSecret: string | undefined,
): ThrottlerGetTrackerFunction {
  const expected = originSecret ? Buffer.from(originSecret) : undefined;
  return (req) => {
    const request = req as Request;
    const client = firstValue(request.headers[CLIENT_IP_HEADER]);
    const secret = firstValue(request.headers[ORIGIN_SECRET_HEADER]);
    if (expected && client && secret && sameSecret(secret, expected)) {
      return normalizeIp(client);
    }
    return normalizeIp(request.ip ?? request.socket.remoteAddress ?? '');
  };
}

// O cabeçalho pode vir repetido ou com uma lista separada por vírgula.
function firstValue(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.split(',')[0]?.trim() || undefined;
}

// Compara em tempo constante, para o tempo de resposta não revelar o segredo.
function sameSecret(received: string, expected: Buffer): boolean {
  const buffer = Buffer.from(received);
  return buffer.length === expected.length && timingSafeEqual(buffer, expected);
}

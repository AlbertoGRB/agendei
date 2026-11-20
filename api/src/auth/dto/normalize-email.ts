import type { TransformFnParams } from 'class-transformer';

// "Ana@Exemplo.com " e "ana@exemplo.com" são o mesmo e-mail (RN11).
export function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

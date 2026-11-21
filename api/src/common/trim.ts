import type { TransformFnParams } from 'class-transformer';

// Tira os espaços das pontas, para "  " não passar como nome.
export function trim({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

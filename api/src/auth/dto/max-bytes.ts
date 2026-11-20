import { ValidateBy, type ValidationOptions } from 'class-validator';

// Limita o tamanho em bytes, e não em caracteres. Letra com acento ocupa
// 2 bytes, e o bcrypt ignora tudo o que passa de 72 bytes.
export function MaxBytes(max: number, options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'maxBytes',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && Buffer.byteLength(value) <= max,
      },
    },
    options,
  );
}

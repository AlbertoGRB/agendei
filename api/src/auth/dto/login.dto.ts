import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';
import { MaxBytes } from './max-bytes.js';
import { normalizeEmail } from './normalize-email.js';

export class LoginDto {
  @ApiProperty({ example: 'ana@exemplo.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  // Sem este limite, a senha cadastrada seguida de qualquer texto passaria,
  // porque o bcrypt só compara os primeiros 72 bytes.
  @ApiProperty()
  @IsString()
  @MaxBytes(72, { message: 'A senha é longa demais' })
  password: string;
}

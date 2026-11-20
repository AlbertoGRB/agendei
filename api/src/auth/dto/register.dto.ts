import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../generated/prisma/client.js';
import { MaxBytes } from './max-bytes.js';
import { normalizeEmail } from './normalize-email.js';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Souza' })
  @IsString()
  @Length(2, 100, { message: 'O nome deve ter entre 2 e 100 caracteres' })
  name: string;

  @ApiProperty({ example: 'ana@exemplo.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(254, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({
    minLength: 8,
    description: 'De 8 caracteres a 72 bytes (letra com acento vale 2)',
  })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
  @MaxBytes(72, { message: 'A senha é longa demais' })
  password: string;

  @ApiProperty({
    enum: Role,
    description: 'Escolhido no cadastro, não muda depois',
  })
  @IsEnum(Role, { message: 'O papel deve ser PROVIDER ou CLIENT' })
  role: Role;

  @ApiPropertyOptional({
    example: 'America/Sao_Paulo',
    description: 'Fuso IANA. Sem ele, vale America/Sao_Paulo',
  })
  @IsOptional()
  @IsTimeZone({ message: 'Fuso horário inválido' })
  timezone?: string;
}

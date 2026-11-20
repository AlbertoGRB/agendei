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
} from 'class-validator';
import { Role } from '../../generated/prisma/client.js';
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

  // O bcrypt ignora o que passa de 72 bytes, então a senha não pode ser maior.
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72, { message: 'A senha deve ter entre 8 e 72 caracteres' })
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

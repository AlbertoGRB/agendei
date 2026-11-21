import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDivisibleBy,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { trim } from '../../common/trim.js';

const DURATION_MESSAGE =
  'A duração deve ser múltipla de 30 minutos, de 30 a 480';

export class CreateServiceDto {
  @ApiProperty({ example: 'Corte de cabelo' })
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'O nome deve ter entre 2 e 100 caracteres' })
  name: string;

  // RN01
  @ApiProperty({
    example: 60,
    description: 'Em minutos: múltiplo de 30, de 30 a 480',
  })
  @IsInt({ message: DURATION_MESSAGE })
  @Min(30, { message: DURATION_MESSAGE })
  @Max(480, { message: DURATION_MESSAGE })
  @IsDivisibleBy(30, { message: DURATION_MESSAGE })
  durationMinutes: number;

  // RN02. O teto evita estourar o inteiro do banco.
  @ApiProperty({
    example: 5000,
    description: 'Em centavos: 5000 = R$ 50,00. De 0 a R$ 100.000,00',
  })
  @IsInt({ message: 'O preço deve ser um número inteiro de centavos' })
  @Min(0, { message: 'O preço não pode ser negativo' })
  @Max(10_000_000, { message: 'O preço deve ser de no máximo R$ 100.000,00' })
  priceCents: number;
}

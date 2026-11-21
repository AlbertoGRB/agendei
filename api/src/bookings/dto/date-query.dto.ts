import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches } from 'class-validator';

export class DateQueryDto {
  @ApiProperty({
    example: '2026-11-23',
    description: 'Dia no fuso do prestador, no formato AAAA-MM-DD',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Use a data no formato AAAA-MM-DD',
  })
  // Recusa datas que não existem, como 30 de fevereiro.
  @IsISO8601({ strict: true }, { message: 'Data inválida' })
  date: string;
}

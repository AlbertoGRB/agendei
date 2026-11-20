import { ApiProperty } from '@nestjs/swagger';

export class AccessTokenDto {
  @ApiProperty({
    description: 'JWT de 15 minutos, enviado no cabeçalho Authorization',
  })
  accessToken: string;
}

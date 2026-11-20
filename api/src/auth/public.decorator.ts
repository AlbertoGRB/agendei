import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Toda rota exige login. Este decorator libera as que são abertas,
// como o cadastro e o login.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

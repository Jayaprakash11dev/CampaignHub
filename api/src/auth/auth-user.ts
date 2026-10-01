import { User } from '@prisma/client';

// What we attach to request.user after the JWT is verified.
// Never includes the password hash.
export type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

export interface JwtPayload {
  sub: number;
  role: User['role'];
}

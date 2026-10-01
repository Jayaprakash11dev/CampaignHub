import { Prisma } from '@prisma/client';

// Prisma error codes we translate into HTTP errors:
//   P2002 - unique constraint violated
//   P2003 - foreign key constraint violated (row is still referenced)
//   P2025 - record to update/delete was not found
export function isPrismaError(err: unknown, code: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === code
  );
}

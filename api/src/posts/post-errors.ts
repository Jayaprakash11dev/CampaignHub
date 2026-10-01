import { ConflictException } from '@nestjs/common';

export function versionMismatchError(currentVersion: number) {
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code: 'VERSION_MISMATCH',
    message: `This post was changed by someone else. Reload to get the latest version (now v${currentVersion}).`,
    currentVersion,
  });
}

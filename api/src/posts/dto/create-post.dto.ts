import { Platform } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePostDto {
  @IsInt()
  clientId: number;

  @IsEnum(Platform)
  platform: Platform;

  // 5000 is the largest platform limit. The exact per-platform limit is
  // checked in the service because it depends on `platform`.
  @IsString()
  @IsNotEmpty()
  // Rejects a caption of only spaces/newlines; otherwise it's stored as typed.
  @Matches(/\S/, { message: 'caption must not be blank' })
  @MaxLength(5000)
  caption: string;

  // ISO 8601 with an explicit timezone, e.g. "2026-10-05T04:30:00.000Z" or
  // "2026-10-05T10:00:00+05:30". Without one, the server would have to guess
  // which timezone was meant. Stored as UTC; the frontend shows IST.
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'scheduledAt must include a timezone, e.g. Z or +05:30',
  })
  scheduledAt: string;
}

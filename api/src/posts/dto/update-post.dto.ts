import { Platform } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

// Status is deliberately not here: it only changes through the
// transitions endpoint, so the workflow rules can't be bypassed.
export class UpdatePostDto {
  // The version the client last saw. If someone saved in between,
  // the update is rejected with 409 instead of overwriting their change.
  @IsInt()
  @Min(1)
  version: number;

  @IsOptional()
  @IsInt()
  clientId?: number;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  caption?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'scheduledAt must include a timezone, e.g. Z or +05:30',
  })
  scheduledAt?: string;
}

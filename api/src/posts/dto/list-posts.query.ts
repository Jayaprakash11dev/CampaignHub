import { Platform, PostStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, Matches } from 'class-validator';

const WITH_TIMEZONE = /(Z|[+-]\d{2}:\d{2})$/;

export class ListPostsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  // Optional time range on scheduledAt (from inclusive, to exclusive),
  // used by the weekly calendar. Must include a timezone, like scheduledAt.
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_TIMEZONE, { message: 'from must include a timezone' })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_TIMEZONE, { message: 'to must include a timezone' })
  to?: string;
}

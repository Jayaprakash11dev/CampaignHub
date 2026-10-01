import { PostStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class TransitionPostDto {
  @IsEnum(PostStatus)
  toStatus: PostStatus;

  // Same optimistic-locking rule as editing: send the version you last saw.
  @IsInt()
  @Min(1)
  version: number;

  // Required (10+ characters) when requesting changes, optional otherwise.
  // Saved to the post's comment thread.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

import { ArrayUnique, IsArray, IsInt } from 'class-validator';

export class AssignReviewersDto {
  // Full list of reviewers for the client. Replaces the current assignment,
  // so an empty array removes everyone.
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  reviewerIds: number[];
}

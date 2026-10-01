import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}

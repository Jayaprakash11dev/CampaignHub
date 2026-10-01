import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

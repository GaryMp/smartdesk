import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSupportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}

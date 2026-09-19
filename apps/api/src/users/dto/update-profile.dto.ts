import { IsOptional, IsString, MaxLength } from "class-validator";
import { IsTimezone } from "../../common/validators/is-timezone.validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsTimezone()
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

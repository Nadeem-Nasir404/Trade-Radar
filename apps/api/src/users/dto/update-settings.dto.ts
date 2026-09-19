import { IsBoolean, IsIn, IsOptional } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(["dark", "light"])
  theme?: string;

  @IsOptional()
  @IsIn(["1m", "5m", "15m", "1h", "4h", "1d", "1w"])
  defaultChartInterval?: string;

  @IsOptional()
  @IsBoolean()
  emailDigestEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;
}

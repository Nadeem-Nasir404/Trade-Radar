import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ConditionType, NotificationChannelType } from "@prisma/client";
import { REPEAT_INTERVAL_MINUTES } from "@levelpulse/shared-types";

export class ChannelPreferenceDto {
  @IsEnum(NotificationChannelType)
  channelType!: NotificationChannelType;

  @IsBoolean()
  isEnabled!: boolean;
}

export class CreateAlertDto {
  @IsString()
  instrumentId!: string;

  @IsEnum(ConditionType)
  conditionType!: ConditionType;

  @IsNumber()
  targetValue!: number;

  @IsOptional()
  @IsNumber()
  secondaryValue?: number;

  @IsOptional()
  @IsIn(["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w"])
  timeframe?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  cooldownSeconds?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /** Keep reminding every N minutes after the alert fires, while the level is still crossed. null turns it off. */
  @IsOptional()
  @IsIn([...REPEAT_INTERVAL_MINUTES, null])
  repeatIntervalMinutes?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  alertGroupId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelPreferenceDto)
  channels?: ChannelPreferenceDto[];
}

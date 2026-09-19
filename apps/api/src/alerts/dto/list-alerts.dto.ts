import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";
import { AlertStatus, AssetType } from "@prisma/client";

export class ListAlertsDto {
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["recent", "nearest", "recently_triggered", "asset"])
  sort?: "recent" | "nearest" | "recently_triggered" | "asset";

  @IsOptional()
  @IsString()
  alertGroupId?: string;
}

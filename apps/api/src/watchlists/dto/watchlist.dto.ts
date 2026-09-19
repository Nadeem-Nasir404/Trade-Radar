import { ArrayMaxSize, IsArray, IsString, MaxLength } from "class-validator";

export class CreateWatchlistDto {
  @IsString()
  @MaxLength(80)
  name!: string;
}

export class AddWatchlistItemDto {
  @IsString()
  instrumentId!: string;
}

export class ReorderWatchlistDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  itemIdsInOrder!: string[];
}

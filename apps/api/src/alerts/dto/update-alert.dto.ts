import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateAlertDto } from "./create-alert.dto";

export class UpdateAlertDto extends PartialType(OmitType(CreateAlertDto, ["instrumentId", "conditionType"] as const)) {}

import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateAlertDto } from "./create-alert.dto";

/**
 * conditionType is accepted only to flip a level alert's direction (dragging its line to the other
 * side of the price); the service rejects any other change of condition.
 */
export class UpdateAlertDto extends PartialType(OmitType(CreateAlertDto, ["instrumentId"] as const)) {}

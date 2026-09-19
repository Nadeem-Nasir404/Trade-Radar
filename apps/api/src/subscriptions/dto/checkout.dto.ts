import { IsIn } from "class-validator";
import { PlanTier } from "@prisma/client";

export class CheckoutDto {
  @IsIn([PlanTier.PRO, PlanTier.MAX])
  plan!: PlanTier;
}

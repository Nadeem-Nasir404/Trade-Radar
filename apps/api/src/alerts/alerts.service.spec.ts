import { ConditionType } from "@prisma/client";
import { isDirectionFlip } from "./alerts.service";

describe("isDirectionFlip (dragging an alert line across the price)", () => {
  it("allows switching between above and below within the same kind", () => {
    expect(isDirectionFlip(ConditionType.CROSSES_ABOVE, ConditionType.CROSSES_BELOW)).toBe(true);
    expect(isDirectionFlip(ConditionType.BELOW, ConditionType.ABOVE)).toBe(true);
    expect(isDirectionFlip(ConditionType.EQUALS, ConditionType.EQUALS)).toBe(true);
  });

  it("rejects changing the kind of alert", () => {
    expect(isDirectionFlip(ConditionType.CROSSES_ABOVE, ConditionType.ABOVE)).toBe(false);
    expect(isDirectionFlip(ConditionType.ABOVE, ConditionType.PCT_CHANGE)).toBe(false);
    expect(isDirectionFlip(ConditionType.ENTERS_RANGE, ConditionType.EXITS_RANGE)).toBe(false);
  });
});

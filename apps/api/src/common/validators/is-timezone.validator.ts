import { registerDecorator, type ValidationOptions } from "class-validator";

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

/** Validates against the full IANA timezone database (via Intl), not a hardcoded shortlist. */
export function IsTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isTimezone",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === "string" && VALID_TIMEZONES.has(value);
        },
        defaultMessage() {
          return "$property must be a valid IANA timezone identifier, e.g. Asia/Karachi";
        },
      },
    });
  };
}

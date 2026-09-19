import { Matches } from "class-validator";

export class RegisterExpoPushDto {
  @Matches(/^Expo(nent)?PushToken\[.+\]$/, { message: "That doesn't look like an Expo push token" })
  token!: string;
}

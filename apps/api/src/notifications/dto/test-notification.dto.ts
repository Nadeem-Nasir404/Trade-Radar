import { IsEnum } from "class-validator";
import { NotificationChannelType } from "@prisma/client";

export class TestNotificationDto {
  @IsEnum(NotificationChannelType)
  channelType!: NotificationChannelType;
}

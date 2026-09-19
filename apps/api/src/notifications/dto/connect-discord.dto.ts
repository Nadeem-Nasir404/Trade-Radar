import { IsUrl } from "class-validator";

export class ConnectDiscordDto {
  @IsUrl({ require_protocol: true })
  webhookUrl!: string;
}

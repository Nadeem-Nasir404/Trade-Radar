import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import type { EnvConfig } from "../config/env.validation";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Thin nodemailer wrapper shared by AuthService (magic links) and the notifications
 * EmailProcessor. Falls back to an auto-created Ethereal test inbox when SMTP_HOST is
 * unset, so email flows are fully exercisable in local dev without real credentials.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter!: Transporter;
  private from!: string;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  async onModuleInit() {
    this.from = this.config.get("SMTP_FROM", { infer: true });
    const host = this.config.get("SMTP_HOST", { infer: true });

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get("SMTP_PORT", { infer: true }) ?? 587,
        secure: false,
        auth: {
          user: this.config.get("SMTP_USER", { infer: true }),
          pass: this.config.get("SMTP_PASS", { infer: true }),
        },
      });
      this.logger.log(`Mailer configured with SMTP host ${host}`);
    } else {
      // createTestAccount() calls out to api.nodemailer.com - on any network/DNS hiccup this
      // throws, and since onModuleInit() runs during Nest bootstrap, an uncaught rejection here
      // used to kill the entire API process before it ever started listening. Fall back to a
      // local JSON transport (never touches the network, just logs what would've been sent) so a
      // flaky network never takes down the whole app over an optional local-dev convenience.
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        this.logger.warn(
          "SMTP_HOST not set - using an auto-created Ethereal test inbox. Preview URLs will be logged for every send.",
        );
      } catch (err) {
        this.transporter = nodemailer.createTransport({ jsonTransport: true });
        this.logger.warn(
          `SMTP_HOST not set and Ethereal test-account creation failed (${(err as Error).message}) - falling back to a local no-op transport. Emails will be logged, not delivered.`,
        );
      }
    }
  }

  async send(input: SendMailInput): Promise<{ messageId: string; previewUrl: string | false }> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      this.logger.log(`Email preview (${input.subject} -> ${input.to}): ${previewUrl}`);
    }
    return { messageId: info.messageId, previewUrl };
  }
}

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { EnvConfig } from "./common/config/env.validation";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<EnvConfig, true>);
  const logger = new Logger("Bootstrap");

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get("CORS_ORIGIN", { infer: true }).split(","),
    credentials: true,
  });

  const apiPrefix = config.get("API_PREFIX", { infer: true });
  app.setGlobalPrefix(apiPrefix, { exclude: ["health", "health/ready"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  logger.log(`LevelPulse API listening on port ${port} (prefix: /${apiPrefix})`);
  if (config.get("DEMO_MODE", { infer: true })) {
    logger.warn("DEMO_MODE is enabled - serving simulated market data, not real prices");
  }
}

bootstrap();

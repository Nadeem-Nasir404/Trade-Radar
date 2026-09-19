import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@levelpulse/shared-types";
import { AlertRegistryService } from "./alert-registry.service";
import { AlertEngineService } from "./alert-engine.service";
import { AlertIndexerService } from "./alert-indexer.service";
import { AlertTriggerProcessor } from "./alert-trigger.processor";
import { PctWindowEvaluatorService } from "./pct-window-evaluator.service";
import { PriceCacheModule } from "../market-data/price-cache/price-cache.module";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.ALERT_TRIGGER }), PriceCacheModule],
  providers: [AlertRegistryService, AlertEngineService, AlertIndexerService, AlertTriggerProcessor, PctWindowEvaluatorService],
  exports: [AlertRegistryService, AlertEngineService, AlertIndexerService],
})
export class AlertEngineModule {}

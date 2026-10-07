import { Module } from "@nestjs/common";
import { AlertRegistryService } from "./alert-registry.service";
import { AlertEngineService } from "./alert-engine.service";
import { AlertIndexerService } from "./alert-indexer.service";
import { AlertTriggerProcessor } from "./alert-trigger.processor";
import { PctWindowEvaluatorService } from "./pct-window-evaluator.service";
import { PriceCacheModule } from "../market-data/price-cache/price-cache.module";

@Module({
  imports: [PriceCacheModule],
  providers: [AlertRegistryService, AlertEngineService, AlertIndexerService, AlertTriggerProcessor, PctWindowEvaluatorService],
  exports: [AlertRegistryService, AlertEngineService, AlertIndexerService],
})
export class AlertEngineModule {}

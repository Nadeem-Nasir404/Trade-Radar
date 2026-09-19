import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AlertStatus, ConditionType, type Alert } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AlertRegistryService } from "./alert-registry.service";

/**
 * Bridges Postgres (source of truth for alert configuration) and Redis (hot-path registries
 * AlertEngineService reads on every tick). AlertsService calls indexAlert/deindexAlert on
 * every create/pause/resume/delete/expire; this service also rebuilds the full Redis state
 * from Postgres on boot, since Redis is a disposable cache, never authoritative.
 *
 * PCT_CHANGE alerts store their baseline price in `secondaryValue` at creation time (see
 * AlertsService.create) and are indexed as a resolved absolute ABOVE/BELOW threshold, reusing
 * the exact same crossing-detection path as plain price alerts - no special-cased evaluator.
 */
@Injectable()
export class AlertIndexerService implements OnModuleInit {
  private readonly logger = new Logger(AlertIndexerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AlertRegistryService,
  ) {}

  async onModuleInit() {
    await this.reconcileFromDatabase();
  }

  async reconcileFromDatabase(): Promise<void> {
    await this.registry.clearAll();
    const alerts = await this.prisma.alert.findMany({ where: { status: AlertStatus.ACTIVE } });
    for (const alert of alerts) await this.indexAlert(alert);
    this.logger.log(`Rebuilt Redis alert registries from Postgres: ${alerts.length} active alert(s)`);
  }

  async indexAlert(alert: Alert): Promise<void> {
    if (alert.status !== AlertStatus.ACTIVE) return;

    if (alert.conditionType === ConditionType.PCT_CHANGE) {
      const baseline = Number(alert.secondaryValue ?? alert.lastEvaluatedPrice ?? 0);
      if (!baseline) {
        this.logger.warn(`Alert ${alert.id} is PCT_CHANGE but has no baseline price - skipping index`);
        return;
      }
      const pct = Number(alert.targetValue);
      const effectiveTarget = baseline * (1 + pct / 100);
      // Reuses the ABOVE/BELOW registries directly: a positive pct target is an upward
      // threshold, negative is downward - registerAsDirectional() picks the right one.
      await this.registerDirectional(alert, effectiveTarget, pct >= 0);
      return;
    }

    if (alert.conditionType === ConditionType.PCT_CHANGE_WINDOW) {
      // Evaluated separately by PctWindowEvaluatorService on a schedule, not ZSET-indexed -
      // but still written to the alert:{id} hash so triggerAlert()'s generic status/cooldown
      // checks work identically to every other condition type.
      await this.registry.register(alert, Number(alert.targetValue));
      return;
    }

    if (alert.conditionType === ConditionType.ENTERS_RANGE || alert.conditionType === ConditionType.EXITS_RANGE) {
      const lower = Number(alert.targetValue);
      const upper = Number(alert.secondaryValue ?? alert.targetValue);
      await this.registry.register(alert, lower, { lower, upper });
      return;
    }

    await this.registry.register(alert, Number(alert.targetValue));
  }

  private async registerDirectional(alert: Alert, effectiveTarget: number, isUpward: boolean): Promise<void> {
    // register() branches on conditionType, so temporarily present the alert as ABOVE/BELOW
    // for indexing purposes only - the persisted Postgres row keeps its real PCT_CHANGE type.
    const proxy: Alert = { ...alert, conditionType: isUpward ? ConditionType.ABOVE : ConditionType.BELOW };
    await this.registry.register(proxy, effectiveTarget);
  }

  async deindexAlert(alertId: string, instrumentId: string, conditionType: ConditionType): Promise<void> {
    const kind =
      conditionType === ConditionType.PCT_CHANGE
        ? ConditionType.ABOVE // effective registry kind resolves the same way register() did; unregister() only needs the kind bucket, not the exact sign, so try both below
        : conditionType;
    await this.registry.unregister(alertId, instrumentId, kind);
    if (conditionType === ConditionType.PCT_CHANGE) {
      await this.registry.unregister(alertId, instrumentId, ConditionType.BELOW);
    }
  }
}

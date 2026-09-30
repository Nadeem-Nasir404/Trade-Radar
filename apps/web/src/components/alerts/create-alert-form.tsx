"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeftRight, Equal, Percent, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCompactPrice } from "@/lib/utils";
import { useCreateAlert } from "@/lib/api/hooks/use-alerts";
import type { ConditionType, NotificationChannelType } from "@levelpulse/shared-types";

const CONDITION_OPTIONS: Array<{ value: ConditionType; label: string; icon: React.ElementType; needsSecondary?: boolean; needsTimeframe?: boolean }> = [
  { value: "CROSSES_ABOVE", label: "Crosses above", icon: ArrowUp },
  { value: "CROSSES_BELOW", label: "Crosses below", icon: ArrowDown },
  { value: "ABOVE", label: "Price above", icon: ArrowUp },
  { value: "BELOW", label: "Price below", icon: ArrowDown },
  { value: "EQUALS", label: "Hits exactly", icon: Equal },
  { value: "ENTERS_RANGE", label: "Enters range", icon: ArrowLeftRight, needsSecondary: true },
  { value: "EXITS_RANGE", label: "Exits range", icon: ArrowLeftRight, needsSecondary: true },
  { value: "PCT_CHANGE", label: "% change since now", icon: Percent },
  { value: "PCT_CHANGE_WINDOW", label: "% change within window", icon: Clock, needsTimeframe: true },
];

const CHANNELS: Array<{ value: NotificationChannelType; label: string }> = [
  { value: "WEBPUSH", label: "Browser" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "EMAIL", label: "Email" },
  { value: "DISCORD", label: "Discord" },
];

export interface CreateAlertFormProps {
  instrumentId: string;
  symbol: string;
  currentPrice?: number | null;
  defaultTargetValue?: number;
  defaultConditionType?: ConditionType;
  onSuccess?: () => void;
}

export function CreateAlertForm({ instrumentId, symbol, currentPrice, defaultTargetValue, defaultConditionType, onSuccess }: CreateAlertFormProps) {
  const [conditionType, setConditionType] = useState<ConditionType>(defaultConditionType ?? "CROSSES_ABOVE");
  const [targetValue, setTargetValue] = useState(defaultTargetValue ? String(defaultTargetValue) : "");
  const [secondaryValue, setSecondaryValue] = useState("");
  const [timeframe, setTimeframe] = useState("1h");
  const [channels, setChannels] = useState<Set<NotificationChannelType>>(new Set(["WEBPUSH"]));
  const [notes, setNotes] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [cooldownMinutes, setCooldownMinutes] = useState("0");

  const createAlert = useCreateAlert();
  const selected = CONDITION_OPTIONS.find((c) => c.value === conditionType)!;

  const toggleChannel = (value: NotificationChannelType) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetValue) return;

    await createAlert.mutateAsync({
      instrumentId,
      conditionType,
      targetValue: Number(targetValue),
      secondaryValue: selected.needsSecondary && secondaryValue ? Number(secondaryValue) : undefined,
      timeframe: selected.needsTimeframe ? timeframe : undefined,
      isRecurring,
      cooldownSeconds: isRecurring ? Number(cooldownMinutes) * 60 : 0,
      notes: notes || undefined,
      channels: CHANNELS.map((c) => ({ channelType: c.value, isEnabled: channels.has(c.value) })),
    });
    onSuccess?.();
  };

  const applyPreset = (pct: number) => {
    if (!currentPrice) return;
    const calculated = currentPrice * (1 + pct / 100);
    setTargetValue(calculated.toFixed(calculated > 10 ? 2 : 4));
  };

  const applyRoundPreset = () => {
    if (!currentPrice) return;
    // Round to neat number e.g. 94820 -> 95000
    const magnitude = Math.pow(10, Math.floor(Math.log10(currentPrice)));
    const step = magnitude / 10;
    const rounded = Math.round(currentPrice / step) * step;
    setTargetValue(String(rounded));
  };

  const getPreviewText = () => {
    if (!targetValue) return "Enter a target level to generate logic";
    const formatted = formatCompactPrice(Number(targetValue));
    switch (conditionType) {
      case "CROSSES_ABOVE":
        return `Fires immediately when ${symbol} crosses above ${formatted}`;
      case "CROSSES_BELOW":
        return `Fires immediately when ${symbol} crosses below ${formatted}`;
      case "ABOVE":
        return `Fires when ${symbol} is trading above ${formatted}`;
      case "BELOW":
        return `Fires when ${symbol} is trading below ${formatted}`;
      case "EQUALS":
        return `Fires exact tick hit at ${formatted}`;
      case "ENTERS_RANGE":
        return `Fires when ${symbol} moves inside range [${targetValue}, ${secondaryValue || "..."}]`;
      case "EXITS_RANGE":
        return `Fires when ${symbol} breaks outside range [${targetValue}, ${secondaryValue || "..."}]`;
      case "PCT_CHANGE":
        return `Fires when ${symbol} moves ${targetValue}% from current baseline`;
      case "PCT_CHANGE_WINDOW":
        return `Fires on ${targetValue}% move within sliding window ${timeframe}`;
      default:
        return `Fires when target condition is met`;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-xl border border-glass-border bg-background-elevated/50 p-3.5">
        <div>
          <p className="text-xs font-medium text-foreground-subtle">Asset</p>
          <p className="font-bold tracking-tight text-foreground">{symbol}</p>
        </div>
        {currentPrice !== undefined && currentPrice !== null && (
          <div className="text-right">
            <p className="text-xs font-medium text-foreground-subtle">Current Spot</p>
            <p className="font-tabular text-xl font-bold text-emerald-400">{formatCompactPrice(currentPrice)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">Condition Type</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CONDITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setConditionType(opt.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all",
                conditionType === opt.value
                  ? "border-brand bg-brand/15 text-foreground shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]"
                  : "border-glass-border bg-glass text-foreground-muted hover:bg-glass-hover hover:text-foreground",
              )}
            >
              <opt.icon className="size-3.5 shrink-0" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="targetValue" className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
            {conditionType.startsWith("PCT_CHANGE") ? "% Move Target" : selected.needsSecondary ? "Lower Bound" : "Target Price"}
          </Label>
          {currentPrice && !conditionType.startsWith("PCT_CHANGE") && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset(1)}
                className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                +1%
              </button>
              <button
                type="button"
                onClick={() => applyPreset(5)}
                className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                +5%
              </button>
              <button
                type="button"
                onClick={() => applyPreset(-1)}
                className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
              >
                -1%
              </button>
              <button
                type="button"
                onClick={() => applyPreset(-5)}
                className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
              >
                -5%
              </button>
              <button
                type="button"
                onClick={applyRoundPreset}
                className="rounded-md border border-brand/20 bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/20"
              >
                Round
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Input
              id="targetValue"
              type="number"
              step="any"
              required
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={conditionType.startsWith("PCT_CHANGE") ? "5" : String(currentPrice ?? "")}
              className="font-tabular text-base font-semibold"
            />
          </div>
          {selected.needsSecondary && (
            <div className="flex flex-col gap-1.5">
              <Input
                id="secondaryValue"
                type="number"
                step="any"
                required
                value={secondaryValue}
                onChange={(e) => setSecondaryValue(e.target.value)}
                placeholder="Upper Bound"
                className="font-tabular text-base font-semibold"
              />
            </div>
          )}
          {selected.needsTimeframe && (
            <div className="flex flex-col gap-1.5">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["5m", "15m", "1h", "4h", "1d"].map((tf) => (
                    <SelectItem key={tf} value={tf}>
                      {tf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">Notification Channels</Label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleChannel(c.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                channels.has(c.value)
                  ? "border-brand bg-brand/20 text-brand shadow-[0_0_12px_-3px_rgba(99,102,241,0.3)]"
                  : "border-glass-border bg-glass text-foreground-muted hover:bg-glass-hover",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs">
        <div className="flex items-center gap-2 font-medium text-brand">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-indigo-500" />
          </span>
          Alert Trigger Logic Preview:
        </div>
        <p className="mt-1 text-foreground-muted">{getPreviewText()}</p>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((v) => !v)}
        className="text-left text-xs font-medium text-foreground-subtle hover:text-foreground"
      >
        {advancedOpen ? "▼ Hide" : "▶ Show"} advanced parameters (Cooldown & Notes)
      </button>

      {advancedOpen && (
        <div className="flex flex-col gap-4 rounded-xl border border-glass-border bg-glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Recurring alert</p>
              <p className="text-xs text-foreground-subtle">Keep firing every time this condition is met again</p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
          {isRecurring && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cooldown">Cooldown (minutes)</Label>
              <Input id="cooldown" type="number" min={0} value={cooldownMinutes} onChange={(e) => setCooldownMinutes(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Weekly resistance, watching for breakout..."
              className="flex w-full rounded-lg border border-glass-border bg-glass px-3.5 py-2 text-sm outline-none placeholder:text-foreground-subtle focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/30"
            />
          </div>
        </div>
      )}

      <Button type="submit" size="lg" disabled={createAlert.isPending || !targetValue} className="w-full font-semibold shadow-[0_0_20px_-3px_rgba(99,102,241,0.4)]">
        {createAlert.isPending ? "Arming Alert..." : "Arm Price Alert"}
      </Button>
    </form>
  );
}

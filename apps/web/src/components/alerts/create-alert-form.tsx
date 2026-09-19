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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-foreground-muted">{symbol}</p>
        {currentPrice !== undefined && currentPrice !== null && (
          <p className="font-tabular text-2xl font-semibold">{formatCompactPrice(currentPrice)}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Condition</Label>
        <div className="grid grid-cols-2 gap-2">
          {CONDITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setConditionType(opt.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                conditionType === opt.value
                  ? "border-brand/50 bg-brand/10 text-foreground"
                  : "border-glass-border bg-glass text-foreground-muted hover:bg-glass-hover",
              )}
            >
              <opt.icon className="size-4 shrink-0" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetValue">
            {conditionType.startsWith("PCT_CHANGE") ? "% move" : selected.needsSecondary ? "Lower bound" : "Price"}
          </Label>
          <Input
            id="targetValue"
            type="number"
            step="any"
            required
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder={conditionType.startsWith("PCT_CHANGE") ? "5" : String(currentPrice ?? "")}
          />
        </div>
        {selected.needsSecondary && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secondaryValue">Upper bound</Label>
            <Input id="secondaryValue" type="number" step="any" required value={secondaryValue} onChange={(e) => setSecondaryValue(e.target.value)} />
          </div>
        )}
        {selected.needsTimeframe && (
          <div className="flex flex-col gap-1.5">
            <Label>Window</Label>
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

      <div className="flex flex-col gap-1.5">
        <Label>Notify me via</Label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleChannel(c.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                channels.has(c.value)
                  ? "border-brand/50 bg-brand/15 text-brand"
                  : "border-glass-border bg-glass text-foreground-muted hover:bg-glass-hover",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((v) => !v)}
        className="text-left text-xs font-medium text-foreground-subtle hover:text-foreground-muted"
      >
        {advancedOpen ? "Hide" : "Show"} advanced options
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

      <Button type="submit" size="lg" disabled={createAlert.isPending || !targetValue}>
        {createAlert.isPending ? "Creating..." : "Create Alert"}
      </Button>
    </form>
  );
}

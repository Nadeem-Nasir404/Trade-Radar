"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";

export function CapacityCalculator() {
  const [alertCount, setAlertCount] = useState(247);

  return (
    <Card className="mx-auto max-w-2xl p-8">
      <p className="text-center text-sm text-foreground-muted">Drag to see how many levels you actually watch</p>
      <p className="mt-2 text-center font-tabular text-5xl font-semibold tracking-tight">{alertCount}</p>
      <p className="text-center text-sm text-foreground-subtle">active alerts</p>
      <Slider value={[alertCount]} onValueChange={([v]) => setAlertCount(v)} min={3} max={500} step={1} className="mt-6" />

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-negative/20 bg-negative/5 p-4 text-center">
          <p className="text-xs text-foreground-subtle">Typical platform limit</p>
          <p className="mt-1 font-tabular text-2xl font-semibold text-negative">3</p>
          <p className="mt-1 text-xs text-negative/80">
            {Math.max(0, alertCount - 3)} of your levels would go unwatched
          </p>
        </div>
        <div className="rounded-xl border border-positive/20 bg-positive/5 p-4 text-center">
          <p className="text-xs text-foreground-subtle">LevelPulse capacity</p>
          <p className="mt-1 font-tabular text-2xl font-semibold text-positive">{alertCount <= 300 ? "300+" : "2000+"}</p>
          <p className="mt-1 text-xs text-positive/80">every one of your levels, watched</p>
        </div>
      </div>
    </Card>
  );
}

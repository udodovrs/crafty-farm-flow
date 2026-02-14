import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sprout, Droplets, Timer, Plus, Trash2 } from "lucide-react";
import { SEEDS, GROW_TIME_MS, PLOT_COST, getTimeRemaining } from "@/lib/gameConfig";

interface GardenSectionProps {
  plots: any[];
  profile: any;
  onInvalidate: () => void;
  onAddPlot: () => void;
  addPlotPending: boolean;
}

const GardenSection = ({ plots, profile, onInvalidate, onAddPlot, addPlotPending }: GardenSectionProps) => {
  const { user } = useAuth();

  const plantMutation = useMutation({
    mutationFn: async ({ plotId, plantType, cost }: { plotId: string; plantType: string; cost: number }) => {
      if (!profile || profile.balance < cost) throw new Error("Недостаточно монет");
      const { error: e1 } = await supabase
        .from("farm_plots")
        .update({ plant_type: plantType, planted_at: new Date().toISOString() })
        .eq("id", plotId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("profiles").update({ balance: profile.balance - cost }).eq("user_id", user!.id);
      if (e2) throw e2;
    },
    onSuccess: () => { onInvalidate(); toast.success("Семена посажены! 🌱"); },
    onError: (e) => toast.error(e.message),
  });

  const harvestMutation = useMutation({
    mutationFn: async (plotId: string) => {
      const { error } = await supabase.rpc("harvest_plot", { p_plot_id: plotId });
      if (error) throw error;
    },
    onSuccess: () => { onInvalidate(); toast.success("Урожай собран! 🧺"); },
    onError: (e) => toast.error(e.message),
  });

  const clearMutation = useMutation({
    mutationFn: async (plotId: string) => {
      const { error } = await supabase.rpc("clear_plot", { p_plot_id: plotId });
      if (error) throw error;
    },
    onSuccess: () => { onInvalidate(); toast.success("Грядка очищена"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Sprout className="h-5 w-5 text-primary" />
            🥕 Огород
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!profile || profile.balance < PLOT_COST || addPlotPending}
            onClick={onAddPlot}
          >
            <Plus className="mr-1 h-3 w-3" />
            Грядка <CurrencyDisplay amount={PLOT_COST} size="sm" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {plots.map((plot) => {
            const seed = SEEDS.find((s) => s.type === plot.plant_type);
            const checkTime = plot.last_harvested_at || plot.planted_at;
            const timer = checkTime ? getTimeRemaining(checkTime, GROW_TIME_MS) : null;

            return (
              <div
                key={plot.id}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border p-2 text-center ${
                  plot.plant_type ? "border-primary/30 bg-primary/5" : "border-dashed border-muted-foreground/30 bg-muted/30"
                }`}
              >
                {plot.plant_type && seed ? (
                  <>
                    <span className="text-2xl">{seed.emoji}</span>
                    <span className="text-[10px] text-muted-foreground">{seed.label}</span>
                    {timer?.ready ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="mt-1 h-6 text-[10px]"
                        onClick={() => harvestMutation.mutate(plot.id)}
                        disabled={harvestMutation.isPending}
                      >
                        Собрать
                      </Button>
                    ) : timer ? (
                      <span className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Timer className="h-3 w-3" /> {timer.minutes}м
                      </span>
                    ) : null}
                    <button
                      className="mt-1 text-muted-foreground hover:text-destructive"
                      onClick={() => clearMutation.mutate(plot.id)}
                      disabled={clearMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Droplets className="h-5 w-5" />
                    <span className="text-[10px]">Пусто</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mb-2 text-xs font-medium text-muted-foreground">Посадить:</p>
        <div className="grid grid-cols-3 gap-2">
          {SEEDS.map((seed) => {
            const emptyPlot = plots.find((p) => !p.plant_type);
            const canAfford = profile && profile.balance >= seed.cost;
            return (
              <Button
                key={seed.type}
                variant="outline"
                className="h-auto flex-col gap-0.5 py-2"
                disabled={!emptyPlot || !canAfford || plantMutation.isPending}
                onClick={() =>
                  emptyPlot && plantMutation.mutate({ plotId: emptyPlot.id, plantType: seed.type, cost: seed.cost })
                }
              >
                <span className="text-lg">{seed.emoji}</span>
                <span className="text-[10px]">{seed.label}</span>
                <CurrencyDisplay amount={seed.cost} size="sm" />
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default GardenSection;

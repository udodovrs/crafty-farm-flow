import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sprout, Droplets, Timer } from "lucide-react";
import { SEEDS, ANIMALS, GROW_TIME_MS, COLLECT_TIME_MS, getTimeRemaining } from "@/lib/gameConfig";
import { useState, useEffect } from "react";

const FarmPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  // Refresh timer display every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: plots, isLoading: plotsLoading } = useQuery({
    queryKey: ["farm_plots", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("farm_plots").select("*").eq("user_id", user!.id).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: pens, isLoading: pensLoading } = useQuery({
    queryKey: ["animal_pens", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("animal_pens").select("*").eq("user_id", user!.id).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const plantMutation = useMutation({
    mutationFn: async ({ plotId, plantType, cost }: { plotId: string; plantType: string; cost: number }) => {
      if (!profile || profile.balance < cost) throw new Error("Недостаточно монет");
      const { error: plotError } = await supabase
        .from("farm_plots")
        .update({ plant_type: plantType, planted_at: new Date().toISOString() })
        .eq("id", plotId);
      if (plotError) throw plotError;
      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ balance: profile.balance - cost })
        .eq("user_id", user!.id);
      if (balanceError) throw balanceError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm_plots"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Семена посажены! 🌱");
    },
    onError: (e) => toast.error(e.message),
  });

  const harvestMutation = useMutation({
    mutationFn: async (plotId: string) => {
      const { error } = await supabase.rpc("harvest_plot", { p_plot_id: plotId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm_plots"] });
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      toast.success("Урожай собран! 🧺");
    },
    onError: (e) => toast.error(e.message),
  });

  const collectMutation = useMutation({
    mutationFn: async (penId: string) => {
      const { error } = await supabase.rpc("collect_animal_product", { p_pen_id: penId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animal_pens"] });
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      toast.success("Продукт собран! 🧺");
    },
    onError: (e) => toast.error(e.message),
  });

  if (plotsLoading || pensLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="text-muted-foreground">Загрузка фермы...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Моя ферма</h1>
          <p className="text-sm text-muted-foreground">Огород и скотный двор</p>
        </div>
        {profile && <CurrencyDisplay amount={profile.balance} size="lg" />}
      </div>

      {/* Garden Section */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Sprout className="h-5 w-5 text-primary" />
            🥕 Огород
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {plots?.map((plot) => {
              const seed = SEEDS.find((s) => s.type === plot.plant_type);
              const timer = plot.planted_at ? getTimeRemaining(plot.planted_at, GROW_TIME_MS) : null;

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

          {/* Seed Selection */}
          <p className="mb-2 text-xs font-medium text-muted-foreground">Посадить:</p>
          <div className="grid grid-cols-2 gap-2">
            {SEEDS.map((seed) => {
              const emptyPlot = plots?.find((p) => !p.plant_type);
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

      {/* Barn Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            🐄 Скотный двор
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {pens?.map((pen) => {
              const animal = ANIMALS.find((a) => a.type === pen.animal_type);
              const timer = pen.last_collected_at
                ? getTimeRemaining(pen.last_collected_at, COLLECT_TIME_MS)
                : pen.animal_type
                ? { ready: true, minutes: 0 }
                : null;

              return (
                <div
                  key={pen.id}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg border p-2 text-center ${
                    pen.animal_type ? "border-accent/30 bg-accent/5" : "border-dashed border-muted-foreground/30 bg-muted/30"
                  }`}
                >
                  {pen.animal_type && animal ? (
                    <>
                      <span className="text-2xl">{animal.emoji}</span>
                      <span className="text-[10px] text-muted-foreground">{animal.label}</span>
                      {timer?.ready ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="mt-1 h-6 text-[10px]"
                          onClick={() => collectMutation.mutate(pen.id)}
                          disabled={collectMutation.isPending}
                        >
                          {animal.productEmoji} Собрать
                        </Button>
                      ) : timer ? (
                        <span className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Timer className="h-3 w-3" /> {timer.minutes}м
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <span className="text-lg">🏚️</span>
                      <span className="text-[10px]">Пустой загон</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmPage;

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sprout, Flower2, TreePine, Wheat, Droplets } from "lucide-react";

const PLANTS = [
  { type: "sunflower", label: "Подсолнух", emoji: "🌻", cost: 5, icon: Flower2 },
  { type: "wheat", label: "Пшеница", emoji: "🌾", cost: 3, icon: Wheat },
  { type: "tree", label: "Дерево", emoji: "🌳", cost: 8, icon: TreePine },
  { type: "flower", label: "Цветок", emoji: "🌸", cost: 4, icon: Flower2 },
];

const FarmPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: plots, isLoading } = useQuery({
    queryKey: ["farm_plots", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_plots")
        .select("*")
        .eq("user_id", user!.id)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const plantMutation = useMutation({
    mutationFn: async ({
      plotId,
      plantType,
      cost,
    }: {
      plotId: string;
      plantType: string;
      cost: number;
    }) => {
      if (!profile || profile.balance < cost) {
        throw new Error("Недостаточно монет");
      }

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
      toast.success("Растение посажено! 🌱");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const clearPlot = useMutation({
    mutationFn: async (plotId: string) => {
      const { error } = await supabase
        .from("farm_plots")
        .update({ plant_type: null, planted_at: null })
        .eq("id", plotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm_plots"] });
      toast.success("Участок очищен");
    },
  });

  if (isLoading) {
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
          <p className="text-sm text-muted-foreground">Посадите растения за монеты</p>
        </div>
        {profile && <CurrencyDisplay amount={profile.balance} size="lg" />}
      </div>

      {/* Farm Grid */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {plots?.map((plot) => (
          <Card
            key={plot.id}
            className={`aspect-square cursor-pointer transition-all hover:shadow-md ${
              plot.plant_type ? "bg-primary/5" : "craft-pattern bg-card"
            }`}
          >
            <CardContent className="flex h-full flex-col items-center justify-center p-2">
              {plot.plant_type ? (
                <>
                  <span className="text-3xl">
                    {PLANTS.find((p) => p.type === plot.plant_type)?.emoji || "🌱"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {PLANTS.find((p) => p.type === plot.plant_type)?.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 text-xs text-destructive"
                    onClick={() => clearPlot.mutate(plot.id)}
                  >
                    Убрать
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Droplets className="h-6 w-6" />
                  <span className="text-xs">Пусто</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plant Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Sprout className="h-5 w-5 text-primary" />
            Что посадить?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {PLANTS.map((plant) => {
              const emptyPlot = plots?.find((p) => !p.plant_type);
              const canAfford = profile && profile.balance >= plant.cost;
              return (
                <Button
                  key={plant.type}
                  variant="outline"
                  className="h-auto flex-col gap-1 py-3"
                  disabled={!emptyPlot || !canAfford || plantMutation.isPending}
                  onClick={() =>
                    emptyPlot &&
                    plantMutation.mutate({
                      plotId: emptyPlot.id,
                      plantType: plant.type,
                      cost: plant.cost,
                    })
                  }
                >
                  <span className="text-xl">{plant.emoji}</span>
                  <span className="text-xs font-medium">{plant.label}</span>
                  <CurrencyDisplay amount={plant.cost} size="sm" />
                </Button>
              );
            })}
          </div>
          {plots?.every((p) => p.plant_type) && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Все участки заняты! Очистите место для новых растений.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmPage;

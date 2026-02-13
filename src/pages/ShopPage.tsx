import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { ANIMALS, PLOT_COST, PEN_COST } from "@/lib/gameConfig";

const ShopPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: pens } = useQuery({
    queryKey: ["animal_pens", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("animal_pens").select("*").eq("user_id", user!.id).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: plots } = useQuery({
    queryKey: ["farm_plots", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("farm_plots").select("*").eq("user_id", user!.id).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const buyAnimal = useMutation({
    mutationFn: async ({ penId, animalType, cost }: { penId: string; animalType: string; cost: number }) => {
      if (!profile || profile.balance < cost) throw new Error("Недостаточно монет");
      const { error: penError } = await supabase.from("animal_pens").update({ animal_type: animalType }).eq("id", penId);
      if (penError) throw penError;
      const { error: balError } = await supabase.from("profiles").update({ balance: profile.balance - cost }).eq("user_id", user!.id);
      if (balError) throw balError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animal_pens"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Животное куплено! 🎉");
    },
    onError: (e) => toast.error(e.message),
  });

  const buyPlot = useMutation({
    mutationFn: async () => {
      if (!profile || profile.balance < PLOT_COST) throw new Error("Недостаточно монет");
      const nextPos = (plots?.length || 0);
      const { error: plotError } = await supabase.from("farm_plots").insert({ user_id: user!.id, position: nextPos });
      if (plotError) throw plotError;
      const { error: balError } = await supabase.from("profiles").update({ balance: profile.balance - PLOT_COST }).eq("user_id", user!.id);
      if (balError) throw balError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm_plots"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Новая грядка куплена! 🌱");
    },
    onError: (e) => toast.error(e.message),
  });

  const buyPen = useMutation({
    mutationFn: async () => {
      if (!profile || profile.balance < PEN_COST) throw new Error("Недостаточно монет");
      const nextPos = (pens?.length || 0);
      const { error: penError } = await supabase.from("animal_pens").insert({ user_id: user!.id, position: nextPos });
      if (penError) throw penError;
      const { error: balError } = await supabase.from("profiles").update({ balance: profile.balance - PEN_COST }).eq("user_id", user!.id);
      if (balError) throw balError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animal_pens"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Новый загон куплен! 🏗️");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="container max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-accent" />
            Магазин
          </h1>
          <p className="text-sm text-muted-foreground">Покупайте животных и расширяйте ферму</p>
        </div>
        {profile && <CurrencyDisplay amount={profile.balance} size="lg" />}
      </div>

      {/* Animals */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">🐄 Животные</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ANIMALS.map((animal) => {
            const emptyPen = pens?.find((p) => !p.animal_type);
            const canAfford = profile && profile.balance >= animal.cost;
            return (
              <div key={animal.type} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{animal.emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{animal.label}</p>
                    <p className="text-xs text-muted-foreground">Даёт: {animal.productEmoji} {animal.productLabel}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!emptyPen || !canAfford || buyAnimal.isPending}
                  onClick={() => emptyPen && buyAnimal.mutate({ penId: emptyPen.id, animalType: animal.type, cost: animal.cost })}
                >
                  <CurrencyDisplay amount={animal.cost} size="sm" />
                </Button>
              </div>
            );
          })}
          {pens?.every((p) => p.animal_type) && (
            <p className="text-center text-xs text-muted-foreground">Все загоны заняты! Купите новый загон.</p>
          )}
        </CardContent>
      </Card>

      {/* Expansions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">🏗️ Расширение</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Новая грядка</p>
              <p className="text-xs text-muted-foreground">Сейчас: {plots?.length || 0} шт.</p>
            </div>
            <Button
              size="sm"
              disabled={!profile || profile.balance < PLOT_COST || buyPlot.isPending}
              onClick={() => buyPlot.mutate()}
            >
              <CurrencyDisplay amount={PLOT_COST} size="sm" />
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Новый загон</p>
              <p className="text-xs text-muted-foreground">Сейчас: {pens?.length || 0} шт.</p>
            </div>
            <Button
              size="sm"
              disabled={!profile || profile.balance < PEN_COST || buyPen.isPending}
              onClick={() => buyPen.mutate()}
            >
              <CurrencyDisplay amount={PEN_COST} size="sm" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopPage;

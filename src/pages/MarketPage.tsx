import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { SEEDS, TREES, ANIMALS, PANTRY_ITEMS, SELL_PRICES } from "@/lib/gameConfig";

const MarketPage = () => {
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

  const { data: pantry } = useQuery({
    queryKey: ["pantry", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pantry_items").select("*").eq("user_id", user!.id);
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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["pantry"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["animal_pens"] });
  };

  // Sell to system
  const sellMutation = useMutation({
    mutationFn: async ({ itemType, quantity }: { itemType: string; quantity: number }) => {
      const price = SELL_PRICES[itemType];
      if (!price) throw new Error("Нельзя продать");
      const { error } = await supabase.rpc("sell_to_system", {
        p_item_type: itemType,
        p_quantity: quantity,
        p_price_per_unit: price,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Продано! 💰"); },
    onError: (e) => toast.error(e.message),
  });

  // Buy animal
  const buyAnimalMutation = useMutation({
    mutationFn: async ({ penId, animalType, cost, currentCount }: { penId: string; animalType: string; cost: number; currentCount: number }) => {
      if (!profile || profile.balance < cost) throw new Error("Недостаточно монет");
      const { error: e1 } = await supabase
        .from("animal_pens")
        .update({ animal_type: animalType, animal_count: currentCount + 1 })
        .eq("id", penId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("profiles").update({ balance: profile.balance - cost }).eq("user_id", user!.id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Животное куплено! 🎉"); },
    onError: (e) => toast.error(e.message),
  });

  const sellableItems = pantry?.filter((p) => p.quantity > 0 && SELL_PRICES[p.item_type]) || [];

  return (
    <div className="container max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-accent" />
            Рынок
          </h1>
          <p className="text-sm text-muted-foreground">Покупайте и продавайте</p>
        </div>
        {profile && <CurrencyDisplay amount={profile.balance} size="lg" />}
      </div>

      {/* Sell to system */}
      {sellableItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">💰 Продать системе</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sellableItems.map((item) => {
              const config = PANTRY_ITEMS[item.item_type];
              const price = SELL_PRICES[item.item_type];
              return (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config?.emoji || "📦"}</span>
                    <div>
                      <p className="text-sm font-medium">{config?.label || item.item_type}</p>
                      <p className="text-xs text-muted-foreground">В наличии: {item.quantity} шт. • Цена: {price} 🪙/шт.</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={sellMutation.isPending}
                    onClick={() => sellMutation.mutate({ itemType: item.item_type, quantity: 1 })}
                  >
                    Продать 1
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Buy Animals */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">🐄 Купить животных</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ANIMALS.map((animal) => {
            // Find a pen that either has this type with room, or is empty
            const compatiblePen = pens?.find(
              (p) => (p.animal_type === animal.type && p.animal_count < animal.maxPerPen) ||
                     (!p.animal_type && p.animal_count === 0)
            );
            const canAfford = profile && profile.balance >= animal.cost;
            return (
              <div key={animal.type} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{animal.emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{animal.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {animal.productEmoji} {animal.productLabel} • Макс. {animal.maxPerPen}/загон
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!compatiblePen || !canAfford || buyAnimalMutation.isPending}
                  onClick={() =>
                    compatiblePen &&
                    buyAnimalMutation.mutate({
                      penId: compatiblePen.id,
                      animalType: animal.type,
                      cost: animal.cost,
                      currentCount: compatiblePen.animal_count || 0,
                    })
                  }
                >
                  <CurrencyDisplay amount={animal.cost} size="sm" />
                </Button>
              </div>
            );
          })}
          {pens?.every((p) => {
            if (!p.animal_type) return false;
            const a = ANIMALS.find((a) => a.type === p.animal_type);
            return a && p.animal_count >= a.maxPerPen;
          }) && (
            <p className="text-center text-xs text-muted-foreground">Все загоны заполнены! Добавьте загон на ферме.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketPage;

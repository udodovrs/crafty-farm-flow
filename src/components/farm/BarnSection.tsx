import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ANIMALS, PEN_COST } from "@/lib/gameConfig";

interface BarnSectionProps {
  pens: any[];
  pantry: any[];
  profile: any;
  onInvalidate: () => void;
  onAddPen: () => void;
  addPenPending: boolean;
}

const BarnSection = ({ pens, pantry, profile, onInvalidate, onAddPen, addPenPending }: BarnSectionProps) => {
  const { user } = useAuth();

  const feedMutation = useMutation({
    mutationFn: async ({ penId, quantity }: { penId: string; quantity: number }) => {
      const { error } = await supabase.rpc("feed_animal", { p_pen_id: penId, p_quantity: quantity });
      if (error) throw error;
    },
    onSuccess: () => { onInvalidate(); toast.success("Животные накормлены! 🧺"); },
    onError: (e) => toast.error(e.message),
  });

  const getPantryQty = (itemType: string) => {
    const item = pantry.find((p) => p.item_type === itemType);
    return item?.quantity || 0;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            🐄 Скотный двор
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!profile || profile.balance < PEN_COST || addPenPending}
            onClick={onAddPen}
          >
            <Plus className="mr-1 h-3 w-3" />
            Загон <CurrencyDisplay amount={PEN_COST} size="sm" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pens.map((pen) => {
            const animal = ANIMALS.find((a) => a.type === pen.animal_type);

            return (
              <div
                key={pen.id}
                className={`rounded-lg border p-3 ${
                  pen.animal_type ? "border-accent/30 bg-accent/5" : "border-dashed border-muted-foreground/30 bg-muted/30"
                }`}
              >
                {pen.animal_type && animal ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{animal.emoji}</span>
                        <div>
                          <span className="text-sm font-medium">{animal.label}</span>
                          <span className="ml-1 text-xs text-muted-foreground">×{pen.animal_count}</span>
                          <span className="ml-1 text-[10px] text-muted-foreground">(макс. {animal.maxPerPen})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{animal.feedEmoji} {animal.feedLabel}: {getPantryQty(animal.feedType)} шт.</span>
                      <span>→</span>
                      <span>{animal.productEmoji} {animal.feedPerProduct} {animal.feedLabel} = 1 {animal.productLabel}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      className="mt-2 h-7 text-xs"
                      disabled={getPantryQty(animal.feedType) < animal.feedPerProduct || feedMutation.isPending}
                      onClick={() => feedMutation.mutate({ penId: pen.id, quantity: 1 })}
                    >
                      {animal.productEmoji} Покормить → 1 {animal.productLabel}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-2 text-muted-foreground">
                    <span className="text-lg">🏚️</span>
                    <span className="text-[10px]">Пустой загон</span>
                    <p className="text-[10px]">Купите животное на Рынке</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default BarnSection;

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { PANTRY_ITEMS } from "@/lib/gameConfig";

const PantryPage = () => {
  const { user } = useAuth();

  const { data: items, isLoading } = useQuery({
    queryKey: ["pantry", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*")
        .eq("user_id", user!.id)
        .order("item_type");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="container max-w-md px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-accent" />
          Кладовая
        </h1>
        <p className="text-sm text-muted-foreground">Ваши собранные продукты</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Загрузка...</p>
      ) : !items || items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="text-4xl">🧺</span>
            <p className="mt-3 text-muted-foreground">Кладовая пуста</p>
            <p className="text-xs text-muted-foreground">Соберите урожай или продукты животных</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const config = PANTRY_ITEMS[item.item_type];
            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col items-center py-6">
                  <span className="text-3xl">{config?.emoji || "📦"}</span>
                  <p className="mt-2 text-sm font-medium">{config?.label || item.item_type}</p>
                  <p className="text-2xl font-bold text-primary">{item.quantity}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PantryPage;

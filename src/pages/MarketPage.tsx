import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { PANTRY_ITEMS } from "@/lib/gameConfig";

const MarketPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sellType, setSellType] = useState("");
  const [sellQty, setSellQty] = useState("1");
  const [sellPrice, setSellPrice] = useState("5");

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

  const { data: listings, isLoading } = useQuery({
    queryKey: ["market_listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_listings")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const sellMutation = useMutation({
    mutationFn: async () => {
      if (!sellType || !user) throw new Error("Выберите товар");
      const qty = parseInt(sellQty);
      const price = parseInt(sellPrice);
      if (qty <= 0 || price <= 0) throw new Error("Неверные значения");

      const pantryItem = pantry?.find((p) => p.item_type === sellType);
      if (!pantryItem || pantryItem.quantity < qty) throw new Error("Недостаточно товара");

      // Deduct from pantry
      const newQty = pantryItem.quantity - qty;
      if (newQty <= 0) {
        const { error } = await supabase.from("pantry_items").delete().eq("id", pantryItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pantry_items").update({ quantity: newQty }).eq("id", pantryItem.id);
        if (error) throw error;
      }

      // Create listing
      const { error } = await supabase.from("market_listings").insert({
        seller_id: user.id,
        item_type: sellType,
        quantity: qty,
        price_per_unit: price,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      queryClient.invalidateQueries({ queryKey: ["market_listings"] });
      setSellType("");
      setSellQty("1");
      setSellPrice("5");
      toast.success("Товар выставлен на продажу! 🏪");
    },
    onError: (e) => toast.error(e.message),
  });

  const buyMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase.rpc("buy_market_listing", { p_listing_id: listingId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market_listings"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      toast.success("Покупка совершена! 🎉");
    },
    onError: (e) => toast.error(e.message),
  });

  const availableItems = pantry?.filter((p) => p.quantity > 0) || [];

  return (
    <div className="container max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-accent" />
            Рынок
          </h1>
          <p className="text-sm text-muted-foreground">Торгуйте с другими игроками</p>
        </div>
        {profile && <CurrencyDisplay amount={profile.balance} size="lg" />}
      </div>

      {/* Sell Form */}
      {availableItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Продать товар</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={sellType} onValueChange={setSellType}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите товар" />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map((item) => {
                  const config = PANTRY_ITEMS[item.item_type];
                  return (
                    <SelectItem key={item.item_type} value={item.item_type}>
                      {config?.emoji} {config?.label || item.item_type} ({item.quantity} шт.)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Кол-во</label>
                <Input type="number" min="1" value={sellQty} onChange={(e) => setSellQty(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Цена за шт.</label>
                <Input type="number" min="1" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" disabled={!sellType || sellMutation.isPending} onClick={() => sellMutation.mutate()}>
              Выставить на продажу
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Listings */}
      <h2 className="mb-3 font-display text-lg font-semibold">Объявления</h2>
      {isLoading ? (
        <p className="text-muted-foreground text-center">Загрузка...</p>
      ) : !listings || listings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <span className="text-3xl">🏪</span>
            <p className="mt-2 text-muted-foreground">Пока нет объявлений</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {listings.map((listing) => {
            const config = PANTRY_ITEMS[listing.item_type];
            const totalCost = listing.price_per_unit * listing.quantity;
            const isOwn = listing.seller_id === user?.id;
            const canAfford = profile && profile.balance >= totalCost;
            return (
              <Card key={listing.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config?.emoji || "📦"}</span>
                    <div>
                      <p className="text-sm font-medium">{config?.label || listing.item_type} × {listing.quantity}</p>
                      <CurrencyDisplay amount={totalCost} size="sm" />
                    </div>
                  </div>
                  {isOwn ? (
                    <span className="text-xs text-muted-foreground">Ваше</span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canAfford || buyMutation.isPending}
                      onClick={() => buyMutation.mutate(listing.id)}
                    >
                      Купить
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarketPage;

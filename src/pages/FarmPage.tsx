import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sprout, Droplets, Timer, Plus, Trash2, TreePine } from "lucide-react";
import {
  SEEDS, TREES, ANIMALS, GROW_TIME_MS, getTimeRemaining,
  PLOT_COST, PEN_COST, TREE_COST,
} from "@/lib/gameConfig";
import { useState, useEffect } from "react";
import GardenSection from "@/components/farm/GardenSection";
import OrchardSection from "@/components/farm/OrchardSection";
import BarnSection from "@/components/farm/BarnSection";

const FarmPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

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

  const { data: trees, isLoading: treesLoading } = useQuery({
    queryKey: ["orchard_trees", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orchard_trees").select("*").eq("user_id", user!.id).order("position");
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

  const { data: pantry } = useQuery({
    queryKey: ["pantry", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pantry_items").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["farm_plots"] });
    queryClient.invalidateQueries({ queryKey: ["orchard_trees"] });
    queryClient.invalidateQueries({ queryKey: ["animal_pens"] });
    queryClient.invalidateQueries({ queryKey: ["pantry"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  // Add plot
  const addPlotMutation = useMutation({
    mutationFn: async () => {
      if (!profile || profile.balance < PLOT_COST) throw new Error("Недостаточно монет");
      const nextPos = plots?.length || 0;
      const { error: e1 } = await supabase.from("farm_plots").insert({ user_id: user!.id, position: nextPos });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("profiles").update({ balance: profile.balance - PLOT_COST }).eq("user_id", user!.id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Новая грядка! 🌱"); },
    onError: (e) => toast.error(e.message),
  });

  // Add tree
  const addTreeMutation = useMutation({
    mutationFn: async () => {
      if (!profile || profile.balance < TREE_COST) throw new Error("Недостаточно монет");
      const nextPos = trees?.length || 0;
      const { error: e1 } = await supabase.from("orchard_trees").insert({ user_id: user!.id, position: nextPos });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("profiles").update({ balance: profile.balance - TREE_COST }).eq("user_id", user!.id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Новое дерево! 🌳"); },
    onError: (e) => toast.error(e.message),
  });

  // Add pen
  const addPenMutation = useMutation({
    mutationFn: async () => {
      if (!profile || profile.balance < PEN_COST) throw new Error("Недостаточно монет");
      const nextPos = pens?.length || 0;
      const { error: e1 } = await supabase.from("animal_pens").insert({ user_id: user!.id, position: nextPos });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("profiles").update({ balance: profile.balance - PEN_COST }).eq("user_id", user!.id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Новый загон! 🏗️"); },
    onError: (e) => toast.error(e.message),
  });

  if (plotsLoading || pensLoading || treesLoading) {
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
          <p className="text-sm text-muted-foreground">Огород, сад и скотный двор</p>
        </div>
        {profile && <CurrencyDisplay amount={profile.balance} size="lg" />}
      </div>

      <GardenSection
        plots={plots || []}
        profile={profile}
        onInvalidate={invalidateAll}
        onAddPlot={() => addPlotMutation.mutate()}
        addPlotPending={addPlotMutation.isPending}
      />

      <OrchardSection
        trees={trees || []}
        profile={profile}
        onInvalidate={invalidateAll}
        onAddTree={() => addTreeMutation.mutate()}
        addTreePending={addTreeMutation.isPending}
      />

      <BarnSection
        pens={pens || []}
        pantry={pantry || []}
        profile={profile}
        onInvalidate={invalidateAll}
        onAddPen={() => addPenMutation.mutate()}
        addPenPending={addPenMutation.isPending}
      />
    </div>
  );
};

export default FarmPage;

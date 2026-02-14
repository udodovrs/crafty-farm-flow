import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { TreePine, Timer, Plus, Trash2 } from "lucide-react";
import { TREES, GROW_TIME_MS, TREE_COST, getTimeRemaining } from "@/lib/gameConfig";

interface OrchardSectionProps {
  trees: any[];
  profile: any;
  onInvalidate: () => void;
  onAddTree: () => void;
  addTreePending: boolean;
}

const OrchardSection = ({ trees, profile, onInvalidate, onAddTree, addTreePending }: OrchardSectionProps) => {
  const { user } = useAuth();

  const plantTreeMutation = useMutation({
    mutationFn: async ({ treeId, treeType, cost }: { treeId: string; treeType: string; cost: number }) => {
      if (!profile || profile.balance < cost) throw new Error("Недостаточно монет");
      const { error: e1 } = await supabase
        .from("orchard_trees")
        .update({ tree_type: treeType, planted_at: new Date().toISOString() })
        .eq("id", treeId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("profiles").update({ balance: profile.balance - cost }).eq("user_id", user!.id);
      if (e2) throw e2;
    },
    onSuccess: () => { onInvalidate(); toast.success("Дерево посажено! 🌳"); },
    onError: (e) => toast.error(e.message),
  });

  const harvestTreeMutation = useMutation({
    mutationFn: async (treeId: string) => {
      const { error } = await supabase.rpc("harvest_tree", { p_tree_id: treeId });
      if (error) throw error;
    },
    onSuccess: () => { onInvalidate(); toast.success("Фрукты собраны! 🍎"); },
    onError: (e) => toast.error(e.message),
  });

  const clearTreeMutation = useMutation({
    mutationFn: async (treeId: string) => {
      const { error } = await supabase.rpc("clear_tree", { p_tree_id: treeId });
      if (error) throw error;
    },
    onSuccess: () => { onInvalidate(); toast.success("Дерево убрано"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <TreePine className="h-5 w-5 text-primary" />
            🌳 Сад
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!profile || profile.balance < TREE_COST || addTreePending}
            onClick={onAddTree}
          >
            <Plus className="mr-1 h-3 w-3" />
            Дерево <CurrencyDisplay amount={TREE_COST} size="sm" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {trees.map((tree) => {
            const treeConfig = TREES.find((t) => t.type === tree.tree_type);
            const checkTime = tree.last_harvested_at || tree.planted_at;
            const timer = checkTime ? getTimeRemaining(checkTime, GROW_TIME_MS) : null;

            return (
              <div
                key={tree.id}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border p-2 text-center ${
                  tree.tree_type ? "border-primary/30 bg-primary/5" : "border-dashed border-muted-foreground/30 bg-muted/30"
                }`}
              >
                {tree.tree_type && treeConfig ? (
                  <>
                    <span className="text-2xl">{treeConfig.emoji}</span>
                    <span className="text-[10px] text-muted-foreground">{treeConfig.label}</span>
                    {timer?.ready ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="mt-1 h-6 text-[10px]"
                        onClick={() => harvestTreeMutation.mutate(tree.id)}
                        disabled={harvestTreeMutation.isPending}
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
                      onClick={() => clearTreeMutation.mutate(tree.id)}
                      disabled={clearTreeMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <TreePine className="h-5 w-5" />
                    <span className="text-[10px]">Пусто</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mb-2 text-xs font-medium text-muted-foreground">Посадить:</p>
        <div className="grid grid-cols-3 gap-2">
          {TREES.map((treeType) => {
            const emptyTree = trees.find((t) => !t.tree_type);
            const canAfford = profile && profile.balance >= treeType.cost;
            return (
              <Button
                key={treeType.type}
                variant="outline"
                className="h-auto flex-col gap-0.5 py-2"
                disabled={!emptyTree || !canAfford || plantTreeMutation.isPending}
                onClick={() =>
                  emptyTree && plantTreeMutation.mutate({ treeId: emptyTree.id, treeType: treeType.type, cost: treeType.cost })
                }
              >
                <span className="text-lg">{treeType.emoji}</span>
                <span className="text-[10px]">{treeType.label}</span>
                <CurrencyDisplay amount={treeType.cost} size="sm" />
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrchardSection;

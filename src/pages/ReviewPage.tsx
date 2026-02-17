import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckSquare, ThumbsUp, HelpCircle, Eye } from "lucide-react";

const ReviewPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["review_tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stitch_tasks")
        .select("*")
        .eq("status", "pending")
        .neq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const { data: myReviews } = await supabase
        .from("reviews")
        .select("task_id")
        .eq("reviewer_id", user!.id);

      const reviewedIds = new Set(myReviews?.map((r) => r.task_id) || []);
      const filteredTasks = data?.filter((t) => !reviewedIds.has(t.id)) || [];

      const userIds = [...new Set(filteredTasks.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds.length > 0 ? userIds : ["none"]);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      return filteredTasks.map(t => ({ ...t, author_name: profileMap.get(t.user_id) || "Рукодельница" }));
    },
    enabled: !!user,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ taskId, decision }: { taskId: string; decision: boolean }) => {
      const { error } = await supabase.rpc("process_review", {
        p_task_id: taskId,
        p_decision: decision,
      });
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      // Cleanup photos from storage via edge function
      try {
        await supabase.functions.invoke("cleanup-stitch-photos", {
          body: { taskId: variables.taskId },
        });
      } catch (e) {
        console.warn("Photo cleanup failed:", e);
      }
      queryClient.invalidateQueries({ queryKey: ["review_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(
        variables.decision
          ? "Работа подтверждена! +2 монетки 🪙"
          : "Сомнение отмечено. +2 монетки 🪙"
      );
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="container max-w-md px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary" />
          Проверка работ
        </h1>
        <p className="text-sm text-muted-foreground">
          Проверяйте чужие вышивки и получайте 2 🪙 за каждую
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      ) : tasks?.length === 0 ? (
        <Card className="p-8 text-center">
          <Eye className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-display text-lg font-medium">Нет работ для проверки</p>
          <p className="text-sm text-muted-foreground">
            Вернитесь позже или отправьте свою вышивку!
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks?.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base">
                    Автор: {(task as any).author_name}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {task.stitch_count} крестиков
                  </span>
                </div>
                <CardDescription>
                  Кодовое слово: <span className="font-bold text-accent">{task.code_word}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground text-center">ДО</p>
                    {task.photo_before_url ? (
                      <img src={task.photo_before_url} alt="До" className="aspect-square w-full rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
                        <span className="text-xs text-muted-foreground">Нет фото</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground text-center">ПОСЛЕ</p>
                    {task.photo_after_url ? (
                      <img src={task.photo_after_url} alt="После" className="aspect-square w-full rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
                        <span className="text-xs text-muted-foreground">Нет фото</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => reviewMutation.mutate({ taskId: task.id, decision: true })}
                    disabled={reviewMutation.isPending}
                  >
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    Подтвердить
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => reviewMutation.mutate({ taskId: task.id, decision: false })}
                    disabled={reviewMutation.isPending}
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Сомневаюсь
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewPage;

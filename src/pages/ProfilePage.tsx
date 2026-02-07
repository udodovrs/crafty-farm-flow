import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { User, Star, CheckCircle, LogOut } from "lucide-react";

const ProfilePage = () => {
  const { user, signOut } = useAuth();

  const { data: profile, isLoading } = useQuery({
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

  const { data: taskStats } = useQuery({
    queryKey: ["task_stats", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stitch_tasks")
        .select("status")
        .eq("user_id", user!.id);
      if (error) throw error;
      return {
        total: data.length,
        approved: data.filter((t) => t.status === "approved").length,
        pending: data.filter((t) => t.status === "pending").length,
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-md px-4 py-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <User className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold">
          {profile?.display_name || "Рукодельница"}
        </h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Balance Card */}
      <Card className="mb-4 bg-primary/5 border-primary/20">
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm text-muted-foreground">Баланс</p>
            <CurrencyDisplay amount={profile?.balance || 0} size="lg" />
          </div>
          <div className="text-4xl">💰</div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center py-4">
            <Star className="mb-1 h-5 w-5 text-craft-gold" />
            <span className="font-display text-xl font-bold">{profile?.reputation || 0}</span>
            <span className="text-xs text-muted-foreground">Репутация</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-4">
            <CheckCircle className="mb-1 h-5 w-5 text-primary" />
            <span className="font-display text-xl font-bold">{profile?.reviews_count || 0}</span>
            <span className="text-xs text-muted-foreground">Проверок</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-4">
            <span className="mb-1 text-xl">🧵</span>
            <span className="font-display text-xl font-bold">{taskStats?.approved || 0}</span>
            <span className="text-xs text-muted-foreground">Вышивок</span>
          </CardContent>
        </Card>
      </div>

      {/* Task Summary */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">Статистика работ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Всего отправлено</span>
              <span className="font-medium">{taskStats?.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Принято</span>
              <span className="font-medium text-primary">{taskStats?.approved || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">На проверке</span>
              <span className="font-medium text-craft-gold">{taskStats?.pending || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Выйти
      </Button>
    </div>
  );
};

export default ProfilePage;

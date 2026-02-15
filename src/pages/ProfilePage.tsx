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
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: taskStats } = useQuery({
    queryKey: ["task_stats", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("stitch_tasks").select("status").eq("user_id", user!.id);
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

      {/* Currencies */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex flex-col items-center py-4">
            <p className="text-xs text-muted-foreground mb-1">Монетки</p>
            <CurrencyDisplay amount={profile?.balance || 0} size="lg" />
          </CardContent>
        </Card>
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="flex flex-col items-center py-4">
            <p className="text-xs text-muted-foreground mb-1">Стичкоинс</p>
            <CurrencyDisplay amount={profile?.stitchcoins || 0} size="lg" type="stitchcoins" />
          </CardContent>
        </Card>
      </div>

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

      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Выйти
      </Button>
    </div>
  );
};

export default ProfilePage;

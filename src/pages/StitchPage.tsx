import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, Upload, Scissors, CheckCircle, XCircle, Clock, Key } from "lucide-react";

const CODE_WORDS = [
  "Подсолнух", "Радуга", "Котик", "Бабочка", "Звезда", "Сердце",
  "Домик", "Облако", "Цветок", "Рыбка", "Птичка", "Ёжик",
  "Грибок", "Ягодка", "Листочек", "Снежинка",
];

const generateCodeWord = () => {
  return CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
};

const StitchPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [codeWord, setCodeWord] = useState<string | null>(null);
  const [photoBefore, setPhotoBefore] = useState<File | null>(null);
  const [photoAfter, setPhotoAfter] = useState<File | null>(null);
  const [previewBefore, setPreviewBefore] = useState<string | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [stitchCount, setStitchCount] = useState("");
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const { data: myTasks, isLoading } = useQuery({
    queryKey: ["my_stitch_tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stitch_tasks")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleFileChange = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void
  ) => {
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!photoBefore || !photoAfter) throw new Error("Загрузите оба фото");
      if (!codeWord) throw new Error("Сначала получите кодовое слово");
      if (!user) throw new Error("Необходимо войти");

      const taskId = crypto.randomUUID();

      const beforeExt = photoBefore.name.split(".").pop();
      const beforePath = `${user.id}/${taskId}/before.${beforeExt}`;
      const { error: beforeError } = await supabase.storage
        .from("stitch-photos")
        .upload(beforePath, photoBefore);
      if (beforeError) throw beforeError;

      const afterExt = photoAfter.name.split(".").pop();
      const afterPath = `${user.id}/${taskId}/after.${afterExt}`;
      const { error: afterError } = await supabase.storage
        .from("stitch-photos")
        .upload(afterPath, photoAfter);
      if (afterError) throw afterError;

      const { data: { publicUrl: beforeUrl } } = supabase.storage
        .from("stitch-photos")
        .getPublicUrl(beforePath);
      const { data: { publicUrl: afterUrl } } = supabase.storage
        .from("stitch-photos")
        .getPublicUrl(afterPath);

      const { error } = await supabase.from("stitch_tasks").insert({
        id: taskId,
        user_id: user.id,
        code_word: codeWord,
        photo_before_url: beforeUrl,
        photo_after_url: afterUrl,
        status: "pending",
        stitch_count: parseInt(stitchCount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_stitch_tasks"] });
      setPhotoBefore(null);
      setPhotoAfter(null);
      setPreviewBefore(null);
      setPreviewAfter(null);
      setStitchCount("");
      setCodeWord(null); // Reset code word after submission
      toast.success("Работа отправлена на проверку! ✨");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const statusConfig = {
    draft: { label: "Черновик", icon: Clock, className: "bg-muted text-muted-foreground" },
    pending: { label: "На проверке", icon: Clock, className: "bg-craft-gold/20 text-craft-gold" },
    approved: { label: "Принято ✓", icon: CheckCircle, className: "bg-primary/20 text-primary" },
    rejected: { label: "Отклонено", icon: XCircle, className: "bg-destructive/20 text-destructive" },
  };

  return (
    <div className="container max-w-md px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Scissors className="h-6 w-6 text-accent" />
          Вышивка
        </h1>
        <p className="text-sm text-muted-foreground">
          Вышейте крестиком, сделайте фото и получите стичкоинс
        </p>
      </div>

      {/* Step 1: Get code word */}
      {!codeWord ? (
        <Card className="mb-4">
          <CardContent className="py-8 text-center">
            <Key className="mx-auto mb-3 h-10 w-10 text-accent" />
            <p className="mb-4 text-sm text-muted-foreground">
              Получите кодовое слово, чтобы начать новую вышивку
            </p>
            <Button onClick={() => setCodeWord(generateCodeWord())}>
              <Key className="mr-2 h-4 w-4" />
              Получить кодовое слово
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Code Word Display */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Кодовое слово</CardTitle>
              <CardDescription>
                Напишите это слово рядом с вышивкой на фото
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed border-accent/50 bg-accent/5 px-4 py-3 text-center">
                <span className="font-display text-xl font-bold text-accent">{codeWord}</span>
              </div>
            </CardContent>
          </Card>

          {/* Stitch Count */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Количество крестиков</CardTitle>
              <CardDescription>Сколько крестиков вы вышили? (1 крестик = 1 🧵)</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="number"
                min="1"
                placeholder="Например: 150"
                value={stitchCount}
                onChange={(e) => setStitchCount(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm"
              />
            </CardContent>
          </Card>

          {/* Photo Upload */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => beforeRef.current?.click()}
            >
              <CardContent className="flex aspect-square flex-col items-center justify-center p-3">
                {previewBefore ? (
                  <img src={previewBefore} alt="До" className="h-full w-full rounded-md object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Camera className="h-8 w-8" />
                    <span className="text-xs font-medium">Фото ДО</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <input
              ref={beforeRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null, setPhotoBefore, setPreviewBefore)}
            />

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => afterRef.current?.click()}
            >
              <CardContent className="flex aspect-square flex-col items-center justify-center p-3">
                {previewAfter ? (
                  <img src={previewAfter} alt="После" className="h-full w-full rounded-md object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <span className="text-xs font-medium">Фото ПОСЛЕ</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <input
              ref={afterRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null, setPhotoAfter, setPreviewAfter)}
            />
          </div>

          <Button
            className="mb-8 w-full"
            disabled={!photoBefore || !photoAfter || !stitchCount || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? "Отправка..." : "Сдать отчет"}
          </Button>
        </>
      )}

      {/* My Tasks History */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Мои работы</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : myTasks?.length === 0 ? (
          <p className="text-sm text-muted-foreground">У вас пока нет работ</p>
        ) : (
          <div className="space-y-2">
            {myTasks?.map((task) => {
              const status = statusConfig[task.status as keyof typeof statusConfig];
              return (
                <Card key={task.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {task.photo_after_url && (
                        <img src={task.photo_after_url} alt="Работа" className="h-10 w-10 rounded object-cover" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {task.stitch_count} крестиков • <span className="text-accent">{task.code_word}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.approvals_count}/1 подтверждений
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={status?.className}>
                      {status?.label}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StitchPage;

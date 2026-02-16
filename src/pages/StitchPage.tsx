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
  "Ягодка", "Листочек", "Снежинка", "Лиса", "Зайчик", "Медведь",
  "Пчёлка", "Божья коровка", "Стрекоза", "Паучок", "Улитка", "Кит",
  "Дельфин", "Черепаха", "Попугай", "Фламинго", "Пингвин", "Сова",
  "Ласточка", "Синица", "Воробей", "Лебедь", "Аист", "Журавль",
  "Ромашка", "Тюльпан", "Роза", "Лилия", "Фиалка", "Василёк",
  "Одуванчик", "Колокольчик", "Ландыш", "Подснежник", "Кактус", "Пальма",
  "Ёлочка", "Берёза", "Дуб", "Яблоня", "Вишня", "Клубника",
  "Малина", "Черника", "Арбуз", "Ананас", "Лимон", "Апельсин",
  "Персик", "Груша", "Банан", "Виноград", "Кошка", "Собака",
  "Хомячок", "Кролик", "Белочка", "Оленёнок", "Волчонок", "Тигрёнок",
  "Львёнок", "Слонёнок", "Жирафик", "Зебра", "Панда", "Коала",
  "Единорог", "Дракончик", "Русалка", "Фея", "Принцесса", "Рыцарь",
  "Корона", "Замок", "Маяк", "Кораблик", "Ракета", "Самолёт",
  "Воздушный шар", "Зонтик", "Варежка", "Шарфик", "Клубок", "Иголка",
  "Напёрсток", "Пуговица", "Ленточка", "Бусинка",
];

const generateCodeWord = () => {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${word}-${digits}`;
};

const compressImage = (file: File, maxWidth = 1200, quality = 0.75, maxSizeBytes = 1024 * 1024): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      const tryCompress = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));
            if (blob.size > maxSizeBytes && q > 0.3) {
              tryCompress(q - 0.1);
            } else {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
            }
          },
          "image/jpeg",
          q
        );
      };
      tryCompress(quality);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
};

const StitchPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [photoBefore, setPhotoBefore] = useState<File | null>(null);
  const [photoAfter, setPhotoAfter] = useState<File | null>(null);
  const [previewBefore, setPreviewBefore] = useState<string | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [stitchCount, setStitchCount] = useState("");
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const { data: draftTask, isLoading: isDraftLoading } = useQuery({
    queryKey: ["draft_stitch_task", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stitch_tasks")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: myTasks, isLoading } = useQuery({
    queryKey: ["my_stitch_tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stitch_tasks")
        .select("*")
        .eq("user_id", user!.id)
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const codeWord = draftTask?.code_word ?? null;

  const getCodeWordMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Необходимо войти");
      const word = generateCodeWord();
      const { error } = await supabase.from("stitch_tasks").insert({
        user_id: user.id,
        code_word: word,
        status: "draft",
        stitch_count: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["draft_stitch_task"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = async (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void
  ) => {
    if (file) {
      try {
        const compressed = await compressImage(file);
        setFile(compressed);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(compressed);
      } catch {
        toast.error("Не удалось обработать изображение");
      }
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!photoBefore || !photoAfter) throw new Error("Загрузите оба фото");
      if (!draftTask) throw new Error("Сначала получите кодовое слово");
      if (!user) throw new Error("Необходимо войти");

      const taskId = draftTask.id;

      const beforePath = `${user.id}/${taskId}/before.jpg`;
      const { error: beforeError } = await supabase.storage
        .from("stitch-photos")
        .upload(beforePath, photoBefore);
      if (beforeError) throw beforeError;

      const afterPath = `${user.id}/${taskId}/after.jpg`;
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

      const { error } = await supabase.from("stitch_tasks").update({
        photo_before_url: beforeUrl,
        photo_after_url: afterUrl,
        status: "pending",
        stitch_count: parseInt(stitchCount) || 0,
      }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_stitch_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["draft_stitch_task"] });
      setPhotoBefore(null);
      setPhotoAfter(null);
      setPreviewBefore(null);
      setPreviewAfter(null);
      setStitchCount("");
      toast.success("Работа отправлена на проверку! ✨");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const statusConfig = {
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

      {isDraftLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : !codeWord ? (
        <Card className="mb-4">
          <CardContent className="py-8 text-center">
            <Key className="mx-auto mb-3 h-10 w-10 text-accent" />
            <p className="mb-4 text-sm text-muted-foreground">
              Получите кодовое слово, чтобы начать новую вышивку
            </p>
            <Button
              onClick={() => getCodeWordMutation.mutate()}
              disabled={getCodeWordMutation.isPending}
            >
              <Key className="mr-2 h-4 w-4" />
              {getCodeWordMutation.isPending ? "Генерация..." : "Получить кодовое слово"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
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

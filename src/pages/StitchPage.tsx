import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, Upload, Scissors, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";

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
  const [codeWord, setCodeWord] = useState(generateCodeWord);
  const [photoBefore, setPhotoBefore] = useState<File | null>(null);
  const [photoAfter, setPhotoAfter] = useState<File | null>(null);
  const [previewBefore, setPreviewBefore] = useState<string | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
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
      if (!user) throw new Error("Необходимо войти");

      const taskId = crypto.randomUUID();

      // Upload before photo
      const beforeExt = photoBefore.name.split(".").pop();
      const beforePath = `${user.id}/${taskId}/before.${beforeExt}`;
      const { error: beforeError } = await supabase.storage
        .from("stitch-photos")
        .upload(beforePath, photoBefore);
      if (beforeError) throw beforeError;

      // Upload after photo
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_stitch_tasks"] });
      setPhotoBefore(null);
      setPhotoAfter(null);
      setPreviewBefore(null);
      setPreviewAfter(null);
      setCodeWord(generateCodeWord());
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
          Новая вышивка
        </h1>
        <p className="text-sm text-muted-foreground">
          Вышейте крестиком, сделайте фото и получите монеты
        </p>
      </div>

      {/* Code Word */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">Кодовое слово</CardTitle>
          <CardDescription>
            Напишите это слово рядом с вышивкой на фото «ПОСЛЕ»
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg border-2 border-dashed border-accent/50 bg-accent/5 px-4 py-3 text-center">
              <span className="font-display text-xl font-bold text-accent">{codeWord}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCodeWord(generateCodeWord())}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Photo Upload */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {/* Before Photo */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => beforeRef.current?.click()}
        >
          <CardContent className="flex aspect-square flex-col items-center justify-center p-3">
            {previewBefore ? (
              <img
                src={previewBefore}
                alt="До"
                className="h-full w-full rounded-md object-cover"
              />
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
          onChange={(e) =>
            handleFileChange(e.target.files?.[0] || null, setPhotoBefore, setPreviewBefore)
          }
        />

        {/* After Photo */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => afterRef.current?.click()}
        >
          <CardContent className="flex aspect-square flex-col items-center justify-center p-3">
            {previewAfter ? (
              <img
                src={previewAfter}
                alt="После"
                className="h-full w-full rounded-md object-cover"
              />
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
          onChange={(e) =>
            handleFileChange(e.target.files?.[0] || null, setPhotoAfter, setPreviewAfter)
          }
        />
      </div>

      <Button
        className="mb-8 w-full"
        disabled={!photoBefore || !photoAfter || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? "Отправка..." : "Отправить на проверку"}
      </Button>

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
                        <img
                          src={task.photo_after_url}
                          alt="Работа"
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          Слово: <span className="text-accent">{task.code_word}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Голоса: {task.approvals_count}✓ / {task.rejections_count}✗
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

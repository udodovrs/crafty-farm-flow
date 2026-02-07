
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  balance INTEGER NOT NULL DEFAULT 50,
  reputation INTEGER NOT NULL DEFAULT 0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create farm_plots table
CREATE TABLE public.farm_plots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0 AND position < 9),
  plant_type TEXT,
  planted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, position)
);

ALTER TABLE public.farm_plots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own farm plots"
  ON public.farm_plots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own farm plots"
  ON public.farm_plots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own farm plots"
  ON public.farm_plots FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own farm plots"
  ON public.farm_plots FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create stitch_tasks table
CREATE TABLE public.stitch_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_word TEXT NOT NULL,
  photo_before_url TEXT,
  photo_after_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  reward_amount INTEGER NOT NULL DEFAULT 20,
  approvals_count INTEGER NOT NULL DEFAULT 0,
  rejections_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stitch_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all tasks"
  ON public.stitch_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own tasks"
  ON public.stitch_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON public.stitch_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.stitch_tasks(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, reviewer_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read reviews for own tasks or own reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (
    reviewer_id = auth.uid() OR 
    task_id IN (SELECT id FROM public.stitch_tasks WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert reviews for others tasks"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid() AND
    task_id NOT IN (SELECT id FROM public.stitch_tasks WHERE user_id = auth.uid())
  );

-- Allow authenticated users to also read reviews when browsing tasks to review
CREATE POLICY "Authenticated can read all reviews to check if already reviewed"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (reviewer_id = auth.uid());

-- Create trigger for auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  -- Create initial 9 farm plots
  INSERT INTO public.farm_plots (user_id, position)
  SELECT NEW.id, generate_series(0, 8);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stitch_tasks_updated_at
  BEFORE UPDATE ON public.stitch_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to process review and update task
CREATE OR REPLACE FUNCTION public.process_review(
  p_task_id UUID,
  p_decision BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_task RECORD;
  v_approvals INTEGER;
  v_rejections INTEGER;
BEGIN
  -- Get task info
  SELECT * INTO v_task FROM public.stitch_tasks WHERE id = p_task_id;
  
  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  
  -- Prevent self-review
  IF v_task.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot review own task';
  END IF;
  
  -- Prevent reviewing non-pending tasks
  IF v_task.status != 'pending' THEN
    RAISE EXCEPTION 'Task is not pending review';
  END IF;
  
  -- Insert review
  INSERT INTO public.reviews (task_id, reviewer_id, decision)
  VALUES (p_task_id, auth.uid(), p_decision);
  
  -- Count approvals and rejections
  SELECT 
    COUNT(*) FILTER (WHERE decision = true),
    COUNT(*) FILTER (WHERE decision = false)
  INTO v_approvals, v_rejections
  FROM public.reviews WHERE task_id = p_task_id;
  
  -- Update task counts
  UPDATE public.stitch_tasks 
  SET approvals_count = v_approvals, rejections_count = v_rejections
  WHERE id = p_task_id;
  
  -- If 2 approvals, approve task and reward
  IF v_approvals >= 2 THEN
    UPDATE public.stitch_tasks SET status = 'approved' WHERE id = p_task_id;
    UPDATE public.profiles SET balance = balance + v_task.reward_amount, reputation = reputation + 1 WHERE user_id = v_task.user_id;
  END IF;
  
  -- If 2 rejections, reject task
  IF v_rejections >= 2 THEN
    UPDATE public.stitch_tasks SET status = 'rejected' WHERE id = p_task_id;
  END IF;
  
  -- Reward reviewer
  UPDATE public.profiles 
  SET balance = balance + 2, reviews_count = reviews_count + 1 
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Storage bucket for stitch photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('stitch-photos', 'stitch-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload stitch photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'stitch-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view stitch photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'stitch-photos');

CREATE POLICY "Users can delete own stitch photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'stitch-photos' AND auth.uid()::text = (storage.foldername(name))[1]);


-- Add stitch_count to stitch_tasks
ALTER TABLE public.stitch_tasks ADD COLUMN stitch_count integer NOT NULL DEFAULT 0;

-- Pantry items table
CREATE TABLE public.pantry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type)
);

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own pantry" ON public.pantry_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pantry" ON public.pantry_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pantry" ON public.pantry_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pantry" ON public.pantry_items FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_pantry_updated_at BEFORE UPDATE ON public.pantry_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Animal pens table
CREATE TABLE public.animal_pens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  position integer NOT NULL,
  animal_type text,
  last_collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.animal_pens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own pens" ON public.animal_pens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pens" ON public.animal_pens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pens" ON public.animal_pens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pens" ON public.animal_pens FOR DELETE USING (auth.uid() = user_id);

-- Market listings table
CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  item_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price_per_unit integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  buyer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active listings" ON public.market_listings FOR SELECT USING (status = 'active' OR seller_id = auth.uid() OR buyer_id = auth.uid());
CREATE POLICY "Users can insert own listings" ON public.market_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update own listings" ON public.market_listings FOR UPDATE USING (auth.uid() = seller_id);

-- Update handle_new_user to create initial animal pens
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.farm_plots (user_id, position)
  SELECT NEW.id, generate_series(0, 8);
  
  INSERT INTO public.animal_pens (user_id, position)
  SELECT NEW.id, generate_series(0, 3);
  
  RETURN NEW;
END;
$function$;

-- Update process_review to use stitch_count for reward (1 cross = 1 coin, minimum 20)
CREATE OR REPLACE FUNCTION public.process_review(p_task_id uuid, p_decision boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_approvals INTEGER;
  v_rejections INTEGER;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_task FROM public.stitch_tasks WHERE id = p_task_id;
  
  IF v_task IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF v_task.user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot review own task'; END IF;
  IF v_task.status != 'pending' THEN RAISE EXCEPTION 'Task is not pending review'; END IF;
  
  INSERT INTO public.reviews (task_id, reviewer_id, decision)
  VALUES (p_task_id, auth.uid(), p_decision);
  
  SELECT 
    COUNT(*) FILTER (WHERE decision = true),
    COUNT(*) FILTER (WHERE decision = false)
  INTO v_approvals, v_rejections
  FROM public.reviews WHERE task_id = p_task_id;
  
  UPDATE public.stitch_tasks 
  SET approvals_count = v_approvals, rejections_count = v_rejections
  WHERE id = p_task_id;
  
  v_reward := GREATEST(v_task.stitch_count, 20);
  
  IF v_approvals >= 2 THEN
    UPDATE public.stitch_tasks SET status = 'approved' WHERE id = p_task_id;
    UPDATE public.profiles SET balance = balance + v_reward, reputation = reputation + 1 WHERE user_id = v_task.user_id;
  END IF;
  
  IF v_rejections >= 2 THEN
    UPDATE public.stitch_tasks SET status = 'rejected' WHERE id = p_task_id;
  END IF;
  
  UPDATE public.profiles 
  SET balance = balance + 2, reviews_count = reviews_count + 1 
  WHERE user_id = auth.uid();
END;
$function$;

-- Harvest plot function (checks 1 hour timer, adds to pantry)
CREATE OR REPLACE FUNCTION public.harvest_plot(p_plot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plot RECORD;
BEGIN
  SELECT * INTO v_plot FROM public.farm_plots WHERE id = p_plot_id AND user_id = auth.uid();
  
  IF v_plot IS NULL THEN RAISE EXCEPTION 'Plot not found'; END IF;
  IF v_plot.plant_type IS NULL THEN RAISE EXCEPTION 'Nothing planted'; END IF;
  IF v_plot.planted_at IS NULL OR v_plot.planted_at + interval '1 hour' > now() THEN
    RAISE EXCEPTION 'Not ready yet';
  END IF;
  
  INSERT INTO public.pantry_items (user_id, item_type, quantity)
  VALUES (auth.uid(), v_plot.plant_type, 1)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = pantry_items.quantity + 1, updated_at = now();
  
  UPDATE public.farm_plots SET plant_type = NULL, planted_at = NULL WHERE id = p_plot_id;
END;
$function$;

-- Collect animal product function (checks 2 hour timer)
CREATE OR REPLACE FUNCTION public.collect_animal_product(p_pen_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pen RECORD;
  v_product text;
BEGIN
  SELECT * INTO v_pen FROM public.animal_pens WHERE id = p_pen_id AND user_id = auth.uid();
  
  IF v_pen IS NULL THEN RAISE EXCEPTION 'Pen not found'; END IF;
  IF v_pen.animal_type IS NULL THEN RAISE EXCEPTION 'No animal'; END IF;
  IF v_pen.last_collected_at IS NOT NULL AND v_pen.last_collected_at + interval '2 hours' > now() THEN
    RAISE EXCEPTION 'Not ready yet';
  END IF;
  
  IF v_pen.animal_type = 'cow' THEN v_product := 'milk';
  ELSIF v_pen.animal_type = 'chicken' THEN v_product := 'eggs';
  ELSE RAISE EXCEPTION 'Unknown animal type';
  END IF;
  
  INSERT INTO public.pantry_items (user_id, item_type, quantity)
  VALUES (auth.uid(), v_product, 1)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = pantry_items.quantity + 1, updated_at = now();
  
  UPDATE public.animal_pens SET last_collected_at = now() WHERE id = p_pen_id;
END;
$function$;

-- Buy market listing function (atomic transaction)
CREATE OR REPLACE FUNCTION public.buy_market_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_listing RECORD;
  v_total_cost INTEGER;
BEGIN
  SELECT * INTO v_listing FROM public.market_listings WHERE id = p_listing_id AND status = 'active';
  
  IF v_listing IS NULL THEN RAISE EXCEPTION 'Listing not found or already sold'; END IF;
  IF v_listing.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot buy own listing'; END IF;
  
  v_total_cost := v_listing.price_per_unit * v_listing.quantity;
  
  IF (SELECT balance FROM public.profiles WHERE user_id = auth.uid()) < v_total_cost THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  UPDATE public.profiles SET balance = balance - v_total_cost WHERE user_id = auth.uid();
  UPDATE public.profiles SET balance = balance + v_total_cost WHERE user_id = v_listing.seller_id;
  UPDATE public.market_listings SET status = 'sold', buyer_id = auth.uid() WHERE id = p_listing_id;
  
  INSERT INTO public.pantry_items (user_id, item_type, quantity)
  VALUES (auth.uid(), v_listing.item_type, v_listing.quantity)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = pantry_items.quantity + EXCLUDED.quantity, updated_at = now();
END;
$function$;

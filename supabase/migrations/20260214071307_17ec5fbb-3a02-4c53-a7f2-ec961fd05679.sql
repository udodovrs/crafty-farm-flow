
-- Add last_harvested_at to farm_plots for continuous production
ALTER TABLE public.farm_plots ADD COLUMN last_harvested_at timestamptz;

-- Add animal_count to animal_pens
ALTER TABLE public.animal_pens ADD COLUMN animal_count integer NOT NULL DEFAULT 0;

-- Set animal_count=1 for existing pens with animals
UPDATE public.animal_pens SET animal_count = 1 WHERE animal_type IS NOT NULL;

-- Create orchard_trees table
CREATE TABLE public.orchard_trees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  position integer NOT NULL,
  tree_type text,
  planted_at timestamptz,
  last_harvested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orchard_trees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own trees" ON public.orchard_trees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trees" ON public.orchard_trees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trees" ON public.orchard_trees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trees" ON public.orchard_trees FOR DELETE USING (auth.uid() = user_id);

-- Update handle_new_user: 3 plots, 1 pen, 1 tree
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.farm_plots (user_id, position)
  SELECT NEW.id, generate_series(0, 2);
  
  INSERT INTO public.animal_pens (user_id, position, animal_count)
  VALUES (NEW.id, 0, 0);
  
  INSERT INTO public.orchard_trees (user_id, position)
  VALUES (NEW.id, 0);
  
  RETURN NEW;
END;
$$;

-- Update harvest_plot: continuous production (don't clear the plant)
CREATE OR REPLACE FUNCTION public.harvest_plot(p_plot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plot RECORD;
  v_check_time timestamptz;
BEGIN
  SELECT * INTO v_plot FROM public.farm_plots WHERE id = p_plot_id AND user_id = auth.uid();
  
  IF v_plot IS NULL THEN RAISE EXCEPTION 'Plot not found'; END IF;
  IF v_plot.plant_type IS NULL THEN RAISE EXCEPTION 'Nothing planted'; END IF;
  
  v_check_time := COALESCE(v_plot.last_harvested_at, v_plot.planted_at);
  IF v_check_time IS NULL OR v_check_time + interval '1 hour' > now() THEN
    RAISE EXCEPTION 'Not ready yet';
  END IF;
  
  INSERT INTO public.pantry_items (user_id, item_type, quantity)
  VALUES (auth.uid(), v_plot.plant_type, 1)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = pantry_items.quantity + 1, updated_at = now();
  
  UPDATE public.farm_plots SET last_harvested_at = now() WHERE id = p_plot_id;
END;
$$;

-- Clear plot function
CREATE OR REPLACE FUNCTION public.clear_plot(p_plot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.farm_plots 
  SET plant_type = NULL, planted_at = NULL, last_harvested_at = NULL 
  WHERE id = p_plot_id AND user_id = auth.uid();
END;
$$;

-- Harvest tree function
CREATE OR REPLACE FUNCTION public.harvest_tree(p_tree_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tree RECORD;
  v_check_time timestamptz;
BEGIN
  SELECT * INTO v_tree FROM public.orchard_trees WHERE id = p_tree_id AND user_id = auth.uid();
  
  IF v_tree IS NULL THEN RAISE EXCEPTION 'Tree not found'; END IF;
  IF v_tree.tree_type IS NULL THEN RAISE EXCEPTION 'Nothing planted'; END IF;
  
  v_check_time := COALESCE(v_tree.last_harvested_at, v_tree.planted_at);
  IF v_check_time IS NULL OR v_check_time + interval '1 hour' > now() THEN
    RAISE EXCEPTION 'Not ready yet';
  END IF;
  
  INSERT INTO public.pantry_items (user_id, item_type, quantity)
  VALUES (auth.uid(), v_tree.tree_type, 1)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = pantry_items.quantity + 1, updated_at = now();
  
  UPDATE public.orchard_trees SET last_harvested_at = now() WHERE id = p_tree_id;
END;
$$;

-- Clear tree function
CREATE OR REPLACE FUNCTION public.clear_tree(p_tree_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.orchard_trees 
  SET tree_type = NULL, planted_at = NULL, last_harvested_at = NULL 
  WHERE id = p_tree_id AND user_id = auth.uid();
END;
$$;

-- Feed animal function (consume pantry feed, produce product)
CREATE OR REPLACE FUNCTION public.feed_animal(p_pen_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pen RECORD;
  v_feed_type text;
  v_product_type text;
  v_feed_needed integer;
  v_pantry_item RECORD;
BEGIN
  SELECT * INTO v_pen FROM public.animal_pens WHERE id = p_pen_id AND user_id = auth.uid();
  IF v_pen IS NULL THEN RAISE EXCEPTION 'Pen not found'; END IF;
  IF v_pen.animal_type IS NULL THEN RAISE EXCEPTION 'No animal'; END IF;
  IF v_pen.animal_count <= 0 THEN RAISE EXCEPTION 'No animals in pen'; END IF;
  
  IF v_pen.animal_type = 'cow' THEN
    v_feed_type := 'clover';
    v_product_type := 'milk';
    v_feed_needed := 3 * p_quantity;
  ELSIF v_pen.animal_type = 'chicken' THEN
    v_feed_type := 'wheat';
    v_product_type := 'eggs';
    v_feed_needed := 1 * p_quantity;
  ELSE
    RAISE EXCEPTION 'Unknown animal type';
  END IF;
  
  SELECT * INTO v_pantry_item FROM public.pantry_items 
  WHERE user_id = auth.uid() AND item_type = v_feed_type;
  
  IF v_pantry_item IS NULL OR v_pantry_item.quantity < v_feed_needed THEN
    RAISE EXCEPTION 'Not enough feed';
  END IF;
  
  IF v_pantry_item.quantity - v_feed_needed <= 0 THEN
    DELETE FROM public.pantry_items WHERE id = v_pantry_item.id;
  ELSE
    UPDATE public.pantry_items 
    SET quantity = quantity - v_feed_needed, updated_at = now()
    WHERE id = v_pantry_item.id;
  END IF;
  
  INSERT INTO public.pantry_items (user_id, item_type, quantity)
  VALUES (auth.uid(), v_product_type, p_quantity)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = pantry_items.quantity + p_quantity, updated_at = now();
END;
$$;

-- Sell to system function
CREATE OR REPLACE FUNCTION public.sell_to_system(p_item_type text, p_quantity integer, p_price_per_unit integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pantry_item RECORD;
  v_total integer;
BEGIN
  SELECT * INTO v_pantry_item FROM public.pantry_items 
  WHERE user_id = auth.uid() AND item_type = p_item_type;
  
  IF v_pantry_item IS NULL OR v_pantry_item.quantity < p_quantity THEN
    RAISE EXCEPTION 'Not enough items';
  END IF;
  
  v_total := p_price_per_unit * p_quantity;
  
  IF v_pantry_item.quantity - p_quantity <= 0 THEN
    DELETE FROM public.pantry_items WHERE id = v_pantry_item.id;
  ELSE
    UPDATE public.pantry_items 
    SET quantity = quantity - p_quantity, updated_at = now()
    WHERE id = v_pantry_item.id;
  END IF;
  
  UPDATE public.profiles SET balance = balance + v_total WHERE user_id = auth.uid();
END;
$$;

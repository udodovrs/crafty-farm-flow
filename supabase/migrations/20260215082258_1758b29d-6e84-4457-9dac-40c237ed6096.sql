
-- Add stitchcoins column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stitchcoins integer NOT NULL DEFAULT 0;

-- Create auto_harvest_all RPC: collects all ready harvests from plots and trees
CREATE OR REPLACE FUNCTION public.auto_harvest_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plot RECORD;
  v_tree RECORD;
  v_check_time timestamptz;
  v_elapsed_ms bigint;
  v_harvests integer;
BEGIN
  -- Auto-harvest garden plots
  FOR v_plot IN 
    SELECT * FROM public.farm_plots 
    WHERE user_id = auth.uid() AND plant_type IS NOT NULL AND planted_at IS NOT NULL
  LOOP
    v_check_time := COALESCE(v_plot.last_harvested_at, v_plot.planted_at);
    v_elapsed_ms := EXTRACT(EPOCH FROM (now() - v_check_time)) * 1000;
    v_harvests := FLOOR(v_elapsed_ms / 3600000.0)::integer; -- 1 hour intervals
    
    IF v_harvests > 0 THEN
      INSERT INTO public.pantry_items (user_id, item_type, quantity)
      VALUES (auth.uid(), v_plot.plant_type, v_harvests)
      ON CONFLICT (user_id, item_type)
      DO UPDATE SET quantity = pantry_items.quantity + v_harvests, updated_at = now();
      
      UPDATE public.farm_plots 
      SET last_harvested_at = v_check_time + (v_harvests * interval '1 hour')
      WHERE id = v_plot.id;
    END IF;
  END LOOP;

  -- Auto-harvest orchard trees
  FOR v_tree IN 
    SELECT * FROM public.orchard_trees 
    WHERE user_id = auth.uid() AND tree_type IS NOT NULL AND planted_at IS NOT NULL
  LOOP
    v_check_time := COALESCE(v_tree.last_harvested_at, v_tree.planted_at);
    v_elapsed_ms := EXTRACT(EPOCH FROM (now() - v_check_time)) * 1000;
    v_harvests := FLOOR(v_elapsed_ms / 3600000.0)::integer;
    
    IF v_harvests > 0 THEN
      INSERT INTO public.pantry_items (user_id, item_type, quantity)
      VALUES (auth.uid(), v_tree.tree_type, v_harvests)
      ON CONFLICT (user_id, item_type)
      DO UPDATE SET quantity = pantry_items.quantity + v_harvests, updated_at = now();
      
      UPDATE public.orchard_trees 
      SET last_harvested_at = v_check_time + (v_harvests * interval '1 hour')
      WHERE id = v_tree.id;
    END IF;
  END LOOP;
END;
$$;

-- Update process_review: require only 1 approval, give stitchcoins instead of balance
CREATE OR REPLACE FUNCTION public.process_review(p_task_id uuid, p_decision boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  -- Only 1 approval needed now, reward stitchcoins
  IF v_approvals >= 1 THEN
    UPDATE public.stitch_tasks SET status = 'approved' WHERE id = p_task_id;
    UPDATE public.profiles SET stitchcoins = stitchcoins + v_reward, reputation = reputation + 1 WHERE user_id = v_task.user_id;
  END IF;
  
  IF v_rejections >= 2 THEN
    UPDATE public.stitch_tasks SET status = 'rejected' WHERE id = p_task_id;
  END IF;
  
  -- Reviewer gets 2 монетки (balance)
  UPDATE public.profiles 
  SET balance = balance + 2, reviews_count = reviews_count + 1 
  WHERE user_id = auth.uid();
END;
$$;

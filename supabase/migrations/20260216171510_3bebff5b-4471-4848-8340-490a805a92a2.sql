
-- Update process_review to delete photos from storage after approval
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
  v_before_path TEXT;
  v_after_path TEXT;
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
  
  -- Only 1 approval needed, reward stitchcoins
  IF v_approvals >= 1 THEN
    -- Delete photos from storage
    v_before_path := v_task.user_id || '/' || v_task.id || '/before.jpg';
    v_after_path := v_task.user_id || '/' || v_task.id || '/after.jpg';
    
    DELETE FROM storage.objects 
    WHERE bucket_id = 'stitch-photos' 
    AND name IN (v_before_path, v_after_path);
    
    -- Clear photo URLs and set status to approved
    UPDATE public.stitch_tasks 
    SET status = 'approved', 
        photo_before_url = NULL, 
        photo_after_url = NULL
    WHERE id = p_task_id;
    
    UPDATE public.profiles 
    SET stitchcoins = stitchcoins + v_reward, reputation = reputation + 1 
    WHERE user_id = v_task.user_id;
  END IF;
  
  IF v_rejections >= 2 THEN
    -- Also clean up photos on rejection
    v_before_path := v_task.user_id || '/' || v_task.id || '/before.jpg';
    v_after_path := v_task.user_id || '/' || v_task.id || '/after.jpg';
    
    DELETE FROM storage.objects 
    WHERE bucket_id = 'stitch-photos' 
    AND name IN (v_before_path, v_after_path);
    
    UPDATE public.stitch_tasks 
    SET status = 'rejected',
        photo_before_url = NULL,
        photo_after_url = NULL
    WHERE id = p_task_id;
  END IF;
  
  -- Reviewer gets 2 монетки (balance)
  UPDATE public.profiles 
  SET balance = balance + 2, reviews_count = reviews_count + 1 
  WHERE user_id = auth.uid();
END;
$$;

-- ==============================================================================
-- 07_sequential_order_numbers.sql
-- Prevents modification staging rows from consuming numbers in orders_order_number_seq
-- so real customer orders always remain 100% sequential (#483, #484, #485...).
-- ==============================================================================

-- 1. Drop UNIQUE constraint on order_number (so modification staging rows can
--    inherit the exact order_number of the original order they modify)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- 2. Remove automatic nextval() from column DEFAULT so BEFORE INSERT trigger controls it
ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;

-- 3. Create smart BEFORE INSERT trigger function
CREATE OR REPLACE FUNCTION public.assign_sequential_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_orig_order_number BIGINT;
  v_clean_phone TEXT;
BEGIN
  -- If caller explicitly provided an order_number, respect it
  IF NEW.order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this row is a Modification Request on an existing confirmed order
  IF COALESCE(NEW.customer_notes, '') LIKE '%تعديل على الأوردر المؤكد%'
     OR COALESCE(NEW.payment_method, '') IN ('mod_merged', 'mod_declined') THEN

    v_clean_phone := RIGHT(REGEXP_REPLACE(COALESCE(NEW.customer_phone, ''), '\D', '', 'g'), 9);

    -- Find the customer's active original order within the last 18 hours
    SELECT o.order_number
      INTO v_orig_order_number
      FROM public.orders o
     WHERE o.created_at >= (NOW() - INTERVAL '18 hours')
       AND COALESCE(o.customer_notes, '') NOT LIKE '%تعديل على الأوردر المؤكد%'
       AND COALESCE(o.payment_method, '') NOT IN ('mod_merged', 'mod_declined')
       AND COALESCE(o.status::text, '') <> 'cancelled'
       AND (
         (NEW.contact_id IS NOT NULL AND o.contact_id = NEW.contact_id)
         OR (LENGTH(v_clean_phone) >= 8 AND RIGHT(REGEXP_REPLACE(COALESCE(o.customer_phone, ''), '\D', '', 'g'), 9) = v_clean_phone)
       )
     ORDER BY o.created_at DESC
     LIMIT 1;

    -- Inherit the original order's number without advancing orders_order_number_seq!
    IF v_orig_order_number IS NOT NULL THEN
      NEW.order_number := v_orig_order_number;
      RETURN NEW;
    END IF;
  END IF;

  -- Normal new order: assign the next sequential number
  NEW.order_number := nextval('public.orders_order_number_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_sequential_order_number ON public.orders;
CREATE TRIGGER trg_assign_sequential_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_sequential_order_number();

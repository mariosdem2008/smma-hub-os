create or replace function public.ai_budget_apply_delta(
  p_agency_id uuid,
  p_month_yyyy_mm text,
  p_delta_usd numeric,
  p_enforce boolean default true
)
returns table (
  allowed boolean,
  budget_id uuid,
  spent_usd numeric,
  budget_usd numeric,
  hard_stop boolean
)
language plpgsql
as $$
declare
  v_budget public.ai_budgets%rowtype;
  v_new_spent numeric;
begin
  select *
    into v_budget
    from public.ai_budgets
   where agency_id = p_agency_id
     and month_yyyy_mm = p_month_yyyy_mm
   order by created_at desc
   limit 1
   for update;

  if not found then
    return query select false, null::uuid, 0::numeric, 0::numeric, true;
    return;
  end if;

  v_new_spent := v_budget.spent_usd + p_delta_usd;

  if p_enforce
     and v_budget.hard_stop
     and (v_budget.spent_usd >= v_budget.budget_usd or v_new_spent > v_budget.budget_usd) then
    return query select false, v_budget.id, v_budget.spent_usd, v_budget.budget_usd, v_budget.hard_stop;
    return;
  end if;

  if p_delta_usd <> 0 then
    update public.ai_budgets
       set spent_usd = v_new_spent
     where id = v_budget.id;
  end if;

  return query select true, v_budget.id, v_new_spent, v_budget.budget_usd, v_budget.hard_stop;
end;
$$;

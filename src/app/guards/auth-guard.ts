import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);

  const { data } = await supabase.Supabase.auth.getSession();

  if (data.session) {
    return true;
  }

  router.navigate(['/register']);
  return false;
};
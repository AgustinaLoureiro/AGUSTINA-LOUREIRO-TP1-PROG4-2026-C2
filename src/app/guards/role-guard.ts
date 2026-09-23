import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export function roleGuard(rolesPermitidos: string[]): CanActivateFn {
  return async () => {
    const supabase = inject(Supabase);
    const router = inject(Router);

    const { data: sessionData } = await supabase.Supabase.auth.getSession();
    if (!sessionData.session) {
      router.navigate(['/register']);
      return false;
    }

    const { data: perfil, error } = await supabase.Supabase
      .from('profiles')
      .select('rol')
      .eq('id', sessionData.session.user.id)
      .single();

    if (error || !perfil || !rolesPermitidos.includes(perfil.rol)) {
      router.navigate(['/']);
      return false;
    }

    return true;
  };
}
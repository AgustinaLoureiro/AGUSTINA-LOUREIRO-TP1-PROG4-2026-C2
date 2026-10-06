import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/** Único cliente de Supabase de la aplicación. */
@Service()
export class Supabase {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_KEY);
  }

  public get Supabase() {
    return this.supabase;
  }

  public get Auth() {
    return this.supabase.auth;
  }

  public get Stg() {
    return this.supabase.storage;
  }
}

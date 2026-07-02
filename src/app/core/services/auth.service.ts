// core/services/auth.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly loading = signal(false);

  readonly authenticated = signal(false);

  private initialized = false;

  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadSession();

    await this.initPromise;
  }

  private async loadSession(): Promise<void> {
    const { data, error } = await this.supabase.client.auth.getSession();

    if (error) {
      console.error('Failed to get auth session', error);
      this.clearState();
      this.initPromise = null;
      return;
    }

    this.setSession(data.session);

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.setSession(session);
    });

    this.initialized = true;
  }

  async login(email: string, password: string): Promise<boolean> {
    this.loading.set(true);

    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password
    });

    this.loading.set(false);

    if (error) {
      console.error('Login failed', error);
      this.clearState();
      return false;
    }

    this.setSession(data.session);
    return true;
  }

  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.clearState();
  }

  private setSession(session: Session | null): void {
    this.session.set(session);
    this.user.set(session?.user ?? null);
    this.authenticated.set(!!session?.user);
  }

  private clearState(): void {
    this.session.set(null);
    this.user.set(null);
    this.authenticated.set(false);
  }
}

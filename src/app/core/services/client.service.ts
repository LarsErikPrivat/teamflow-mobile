// core/services/client.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Client } from '../models/client.model';
import { SupabaseService } from './supabase.service';

export type ClientRole = 'super_admin' | 'admin' | 'user';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly supabase = inject(SupabaseService);

  readonly clientId = signal<string | null>(null);
  readonly clientName = signal<string | null>(null);
  readonly role = signal<ClientRole | null>(null);
  readonly isSuperAdmin = signal(false);

  readonly clients = signal<Client[]>([]);
  readonly selectedClientId = signal<string | null>(null);

  async ensureClientLoaded(): Promise<void> {
    await this.loadClient();
  }

  async loadClient(): Promise<void> {
    const { data: userData, error: userError } =
      await this.supabase.client.auth.getUser();

    if (userError || !userData.user) {
      throw new Error('No logged-in user found');
    }

    const { data, error } = await this.supabase.client
      .from('client_users')
      .select(`
        client_id,
        role,
        clients (
          id,
          name
        )
      `)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load client', error);
      throw error;
    }

    if (!data) {
      throw new Error(
        `User ${userData.user.email} is not assigned to a client`
      );
    }

    const client = Array.isArray(data.clients)
      ? data.clients[0]
      : data.clients;

    this.clientId.set(data.client_id);
    this.clientName.set(client?.name ?? null);
    this.role.set((data.role ?? 'user') as ClientRole);
    this.isSuperAdmin.set(data.role === 'super_admin');
  }

  async loadClients(): Promise<void> {
    if (!this.isSuperAdmin()) {
      this.clients.set([]);
      return;
    }

    const { data, error } = await this.supabase.client
      .from('clients')
      .select('id, name, created_at')
      .order('name');

    if (error) {
      console.error('Failed to load clients', error);
      throw error;
    }

    this.clients.set(data ?? []);
  }

  async createClient(name: string): Promise<void> {
    if (!this.isSuperAdmin()) {
      throw new Error('Only super admin can create clients');
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error('Client name is required');
    }

    const { error } = await this.supabase.client
      .from('clients')
      .insert({ name: trimmedName });

    if (error) {
      console.error('Failed to create client', error);
      throw error;
    }

    await this.loadClients();
  }


 async renameClient(clientId: string, name: string): Promise<void> {
  if (!this.isSuperAdmin()) {
    throw new Error('Only super admin can rename clients');
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Client name is required');
  }

  const { error } = await this.supabase.client
    .from('clients')
    .update({ name: trimmedName })
    .eq('id', clientId);

  if (error) {
    console.error('Failed to rename client', error);
    throw error;
  }

  await this.loadClients();

  if (this.clientId() === clientId) {
    this.clientName.set(trimmedName);
  }
}

  requireClientId(): string {
    const id = this.clientId();

    if (!id) {
      throw new Error('No active client loaded');
    }

    return id;
  }

  switchClient(clientId: string): void {
  const client = this.clients().find(c => c.id === clientId);

  if (!client) {
    return;
  }

  this.selectedClientId.set(client.id);
  this.clientId.set(client.id);
  this.clientName.set(client.name);

  localStorage.setItem(
    'active-client-id',
    client.id
  );
}
async setActiveClient(client: Client): Promise<void> {
  if (!this.isSuperAdmin()) {
    throw new Error('Only super admin can switch client');
  }

  this.clientId.set(client.id);
  this.clientName.set(client.name);

  localStorage.setItem('active-client-id', client.id);
}
  clear(): void {
    this.clientId.set(null);
    this.clientName.set(null);
    this.role.set(null);
    this.isSuperAdmin.set(false);
    this.clients.set([]);
  }
}

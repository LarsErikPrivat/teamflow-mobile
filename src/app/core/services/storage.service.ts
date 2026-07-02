import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly http = inject(HttpClient);

  async getCollection<T>(storageKey: string, assetPath: string): Promise<T[]> {
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      return JSON.parse(stored) as T[];
    }

    const seedData = await firstValueFrom(this.http.get<T[]>(assetPath));
    localStorage.setItem(storageKey, JSON.stringify(seedData));
    return seedData;
  }

  async getObject<T>(storageKey: string, assetPath: string): Promise<T> {
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      return JSON.parse(stored) as T;
    }

    const seedData = await firstValueFrom(this.http.get<T>(assetPath));
    localStorage.setItem(storageKey, JSON.stringify(seedData));
    return seedData;
  }

  saveCollection<T>(storageKey: string, data: T[]): void {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  saveObject<T>(storageKey: string, data: T): void {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  remove(storageKey: string): void {
    localStorage.removeItem(storageKey);
  }
}
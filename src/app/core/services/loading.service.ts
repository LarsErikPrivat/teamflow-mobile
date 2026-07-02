import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private activeRequests = 0;

  readonly loading = signal(false);

  show(): void {
    this.activeRequests++;
    this.loading.set(true);
  }

  hide(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.loading.set(this.activeRequests > 0);
  }

  async track<T>(promise: Promise<T>): Promise<T> {
    this.show();

    try {
      return await promise;
    } finally {
      this.hide();
    }
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AlertMessage {
  type: 'success' | 'danger' | 'warning';
  text: string;
  timeout?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private queue: AlertMessage[] = [];
  private _alert$ = new BehaviorSubject<AlertMessage | null>(null);
  alert$ = this._alert$.asObservable();
  private showing = false;

  show(type: 'success' | 'danger' | 'warning', text: string, timeout: number = 4000) {
    this.queue.push({ type, text, timeout });
    this.processQueue();
  }

  private processQueue() {
    if (this.showing || this.queue.length === 0) return;
    const alert = this.queue.shift()!;
    this.showing = true;
    this._alert$.next(alert);

    setTimeout(() => {
      this.clear();
      this.showing = false;
      this.processQueue();
    }, alert.timeout ?? 4000);
  }

  success(text: string, timeout?: number) {
    this.show('success', text, timeout);
  }
  error(text: string, timeout?: number) {
    this.show('danger', text, timeout);
  }
  warning(text: string, timeout?: number) {
    this.show('warning', text, timeout);
  }
  clear() {
    this._alert$.next(null);
  }
}

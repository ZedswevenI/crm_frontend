import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface BreadcrumbItem {
  label: string;
  link?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BredcrumpService {
  private itemsSubject = new BehaviorSubject<BreadcrumbItem[]>([]);
  items$ = this.itemsSubject.asObservable();

  set(items: BreadcrumbItem[]) {
    this.itemsSubject.next(items);
  }

  clear() {
    this.itemsSubject.next([]);
  }
}

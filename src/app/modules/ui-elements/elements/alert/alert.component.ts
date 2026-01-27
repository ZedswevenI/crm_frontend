import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertService, AlertMessage } from '../../../../service/alert/alert.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'alert',
  standalone: false,
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.scss'
})
export class AlertComponent implements OnInit, OnDestroy {
  alert: AlertMessage | null = null;
  sub!: Subscription;

  constructor(private alertService: AlertService) {}

  ngOnInit() {
    this.sub = this.alertService.alert$.subscribe((msg) => (this.alert = msg));
  }
  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  close() {
    this.alertService.clear();
  }
}

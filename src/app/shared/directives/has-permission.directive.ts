// ============================================================
//  has-permission.directive.ts  –  Structural directive for
//  button/section-level gating.
//
//  Usage:
//    <button *appHasPermission="'accounts:reconcileCheque'">Reconcile</button>
//    <div *appHasPermission="['admission:approve','admission:reject']">...</div>   (any-of)
//
//  Re-evaluates whenever PermissionService's in-memory permissions$
//  emits — matters because permissions may still be loading (async
//  fetch after a page reload) at the moment this directive first
//  renders; a one-shot check would incorrectly hide elements that
//  should become visible once the fetch resolves.
// ============================================================

import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { PermissionService } from '../permission.service';

@Directive({
  selector: '[appHasPermission]',
  standalone: false,
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private required: string[] = [];
  private sub?: Subscription;
  private hasView = false;

  @Input()
  set appHasPermission(keys: string | string[]) {
    this.required = Array.isArray(keys) ? keys : keys ? [keys] : [];
    this.updateView();
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService,
  ) {}

  ngOnInit(): void {
    this.sub = this.permissionService.permissions$.subscribe(() => this.updateView());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private updateView(): void {
    const allowed = this.required.length === 0 || this.permissionService.hasAny(this.required);
    if (allowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

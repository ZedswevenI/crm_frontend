import { Injectable } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';

export interface BackTarget {
  route: string | any[];
  state?: any;
}

@Injectable({
  providedIn: 'root',
})
export class BackNavigationService {
  constructor(private router: Router) {}

  /**
   * Resolves where "Back" should go: if the caller navigated in with
   * `history.state.source` set and a matching entry exists in `sourceTargets`,
   * that target is used; otherwise `defaultTarget` is used. This keeps back
   * navigation predictable on deep-link/refresh (no history to walk back into),
   * while still returning to the correct parent screen when reachable from
   * more than one place.
   */
  resolveBackTarget(
    defaultTarget: BackTarget,
    sourceTargets: Record<string, BackTarget> = {},
  ): BackTarget {
    const state: any = history.state || {};
    const source = state.source;
    if (source && sourceTargets[source]) {
      return sourceTargets[source];
    }
    return defaultTarget;
  }

  goBack(
    defaultTarget: BackTarget,
    sourceTargets: Record<string, BackTarget> = {},
  ): void {
    const target = this.resolveBackTarget(defaultTarget, sourceTargets);
    const route = Array.isArray(target.route) ? target.route : [target.route];
    const extras: NavigationExtras | undefined = target.state
      ? { state: target.state }
      : undefined;
    this.router.navigate(route, extras);
  }
}

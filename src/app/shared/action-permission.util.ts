// ============================================================
//  action-permission.util.ts  –  Filters a list-table `actions`
//  array (icon buttons keyed by tooltip label) down to only the
//  entries the current user is permitted to use.
//
//  Usage in a component:
//    get visibleActions() {
//      return filterActionsByTooltip(this.actions, this.permissionService, {
//        Edit: 'orgCenter:edit',
//        Delete: 'orgCenter:delete',
//      });
//    }
//  Bind the template to `[actions]="visibleActions"` instead of `[actions]="actions"`.
//  A tooltip with no entry in the map (e.g. "View") is always shown.
// ============================================================

import { PermissionService } from './permission.service';

export function filterActionsByTooltip(
  actions: any[],
  permissionService: PermissionService,
  tooltipPermissionMap: Record<string, string | string[]>,
): any[] {
  return (actions || []).filter((a) => {
    const required = tooltipPermissionMap[a?.tooltip];
    if (!required) return true;
    const keys = Array.isArray(required) ? required : [required];
    return permissionService.hasAny(keys);
  });
}

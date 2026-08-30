// Declares/exports permission-related structural directives so any feature
// module can `imports: [PermissionSharedModule]` to use *appHasPermission.
import { NgModule } from '@angular/core';
import { HasPermissionDirective } from './directives/has-permission.directive';

@NgModule({
  declarations: [HasPermissionDirective],
  exports: [HasPermissionDirective],
})
export class PermissionSharedModule {}

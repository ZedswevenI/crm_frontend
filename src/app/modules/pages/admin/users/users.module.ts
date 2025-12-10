import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../../ui-elements/ui-elements.module';
import { UsersRoutingModule } from './users-routing.module';
import { UsersComponent } from './users/users.component';

@NgModule({
  declarations: [
    UsersComponent
  ],
  imports: [CommonModule, UsersRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class UsersModule {}

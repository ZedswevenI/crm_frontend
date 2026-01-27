import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { BatchRoutingModule } from './batch-routing.module';
import { BatchComponent } from './batch/batch.component';
import { BatchviewComponent } from './batchview/batchview.component';

@NgModule({
  declarations: [BatchComponent, BatchviewComponent],
  imports: [CommonModule, BatchRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class BatchModule {}

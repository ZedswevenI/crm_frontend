import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PhaseplanRoutingModule } from './phaseplan-routing.module';
import { UiElementsModule } from '../../ui-elements/ui-elements.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PhaseCreateComponent } from './phase-create/phase-create.component';
import { PhaselistComponent } from './phaselist/phaselist.component';
import { PhaseViewComponent } from './phase-view/phase-view.component';

@NgModule({
  declarations: [PhaseCreateComponent, PhaselistComponent, PhaseViewComponent],
  imports: [CommonModule, PhaseplanRoutingModule, UiElementsModule, FormsModule, ReactiveFormsModule]
})
export class PhaseplanModule {}

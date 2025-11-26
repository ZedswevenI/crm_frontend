import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiElementsRoutingModule } from './ui-elements-routing.module';
import { AutocompleteComponent } from './elements/autocomplete/autocomplete.component';
import { CheckboxComponent } from './elements/checkbox/checkbox.component';
import { ChipsComponent } from './elements/chips/chips.component';
import { DoceditorComponent } from './elements/doceditor/doceditor.component';
import { FormfieldComponent } from './elements/formfield/formfield.component';
import { ListTableComponent } from './elements/list-table/list-table.component';
import { MultiselectComponent } from './elements/multiselect/multiselect.component';
import { RadiobuttonComponent } from './elements/radiobutton/radiobutton.component';
import { SelectboxComponent } from './elements/selectbox/selectbox.component';
import { TabledataComponent } from './elements/tabledata/tabledata.component';
import { TogglebuttonComponent } from './elements/togglebutton/togglebutton.component';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    AutocompleteComponent,
    CheckboxComponent,
    ChipsComponent,
    DoceditorComponent,
    FormfieldComponent,
    ListTableComponent,
    MultiselectComponent,
    RadiobuttonComponent,
    SelectboxComponent,
    TabledataComponent,
    TogglebuttonComponent
  ],
  imports: [
    CommonModule, 
    UiElementsRoutingModule,
    FormsModule
],
  exports: [
    FormfieldComponent,
    SelectboxComponent,
    CheckboxComponent,
    MultiselectComponent,
    RadiobuttonComponent,
    ListTableComponent
  ]
})
export class UiElementsModule {}
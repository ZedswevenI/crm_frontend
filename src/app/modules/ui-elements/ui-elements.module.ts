import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiElementsRoutingModule } from './ui-elements-routing.module';
import { AutocompleteComponent } from './elements/autocomplete/autocomplete.component';
import { CheckboxComponent } from './elements/checkbox/checkbox.component';
import { DoceditorComponent } from './elements/doceditor/doceditor.component';
import { FormfieldComponent } from './elements/formfield/formfield.component';
import { ListTableComponent } from './elements/list-table/list-table.component';
import { MultiselectComponent } from './elements/multiselect/multiselect.component';
import { RadiobuttonComponent } from './elements/radiobutton/radiobutton.component';
import { SelectboxComponent } from './elements/selectbox/selectbox.component';
import { TabledataComponent } from './elements/tabledata/tabledata.component';
import { TogglebuttonComponent } from './elements/togglebutton/togglebutton.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { AlertComponent } from './elements/alert/alert.component';
import { BredcrumpComponent } from './elements/bredcrump/bredcrump.component';
import { CommondeleteComponent } from './elements/commondelete/commondelete.component';
import { DescriptionComponent } from './elements/description/description.component';
import { EditableComponent } from './elements/editable/editable.component';
import { ImportfilesComponent } from './elements/importfiles/importfiles.component';
import { ReadonlyComponent } from './elements/readonly/readonly.component';
import { TaginputComponent } from './elements/taginput/taginput.component';

@NgModule({
  declarations: [
    AutocompleteComponent,
    CheckboxComponent,
    DoceditorComponent,
    FormfieldComponent,
    ListTableComponent,
    MultiselectComponent,
    RadiobuttonComponent,
    SelectboxComponent,
    TabledataComponent,
    TogglebuttonComponent,
    DescriptionComponent,
    ImportfilesComponent,
    ReadonlyComponent,
    TaginputComponent,
    CommondeleteComponent,
    EditableComponent,
    AlertComponent,
    BredcrumpComponent
  ],
  imports: [
    CommonModule, 
    UiElementsRoutingModule,
    FormsModule,
    QuillModule.forRoot(),
    ReactiveFormsModule,
    FormsModule,
],
  exports: [
    FormfieldComponent,
    SelectboxComponent,
    CheckboxComponent,
    MultiselectComponent,
    RadiobuttonComponent,
    ListTableComponent,
    AutocompleteComponent,
    DoceditorComponent,
    TogglebuttonComponent,
    TabledataComponent,
    DescriptionComponent,
    ImportfilesComponent,
    ReadonlyComponent,
    TaginputComponent,
    CommondeleteComponent,
    EditableComponent,
    AlertComponent,
    BredcrumpComponent
  ]
})
export class UiElementsModule {}
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ApplayoutComponent } from './applayout/applayout.component'; 
import { ApplayoutRoutingModule } from './applayout.routing.module';
import { FooterComponent } from './applayout/footer/footer.component';
import { SidebarComponent } from './applayout/sidebar/sidebar.component';
import { HeaderComponent } from './applayout/header/header.component';
import { TablerIconsModule } from "angular-tabler-icons";
import * as TablerIcons from "angular-tabler-icons/icons";

@NgModule({
  declarations: [
    ApplayoutComponent,
    HeaderComponent,
    FooterComponent,
    SidebarComponent
  ],
  imports: [
    CommonModule,
    ApplayoutRoutingModule,
    TablerIconsModule.pick(TablerIcons),
  ],
})
export class ApplayoutModule {}


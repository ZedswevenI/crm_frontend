import { Component } from '@angular/core';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

@Component({
  selector: 'app-admissioncommunication',
  standalone: false,
  templateUrl: './admissioncommunication.component.html',
  styleUrl: './admissioncommunication.component.scss'
})
export class AdmissioncommunicationComponent {

  constructor(private breadcrumb: BredcrumpService){
     this.breadcrumb.set([{ label: 'Admissions & Fees' }, { label: 'Admission' }, { label: 'Communications' }]);
  }
}

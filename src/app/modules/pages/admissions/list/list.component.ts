import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type AdmissionStatus = 'draft' | 'submitted' | 'ack_generated' | 'approval_sent' | 'confirmed';

@Component({
  selector: 'app-list',
  standalone: false,
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss'
})
export class ListComponent {
  admissions: any[] = [
    {
      id: 'ADM-001',
      regNo: '9001111012809250093',
      name: 'NIDHIN K',
      programName: 'Aspire 4 Year',
      centerName: 'Gandhipuram',
      finalFee: 835000,
      status: 'confirmed' as AdmissionStatus
    }
  ];

  // ✅ list-table columns
  columns = [
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'name', label: 'Student', sortable: true },
    { key: 'programName', label: 'Program', sortable: true },
    { key: 'centerName', label: 'Centre', sortable: true },
    { key: 'finalFee', label: 'Final Fee', sortable: true },
    { key: 'status', label: 'Status', sortable: false }
  ];

  // ✅ actions like your batch screen
  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      color: '#2563EB',
      callback: (row: any) => this.view(row.id)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      callback: (row: any) => this.edit(row.id)
    }
  ];

  constructor(private router: Router, private breadcrumb: BredcrumpService) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Admissions' }]);
  }

  newAdmission(): void {
    this.router.navigate(['/app/admissions/new']);
  }

  view(id: string): void {
    // later route to view page
    console.log('view', id);
  }

  edit(id: string): void {
    // later route to edit page
    console.log('edit', id);
  }
}

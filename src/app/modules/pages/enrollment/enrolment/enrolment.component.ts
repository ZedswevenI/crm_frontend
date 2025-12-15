import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

@Component({
  selector: 'app-enrolment',
  standalone: false,
  templateUrl: './enrolment.component.html',
  styleUrl: './enrolment.component.scss',
})
export class EnrolmentComponent implements OnInit {
  showEnroll = false;
  selected: any = null;

  enrollForm!: FormGroup;

  // Dummy students
  students: any[] = [
    {
      id: 'STD-1',
      regNo: '9001111012809250093',
      name: 'NIDHIN K',
      program: 'Aspire 4 Year',
      center: 'Gandhipuram',
      batchName: null,
      status: 'Not Enrolled',
    },
    {
      id: 'STD-2',
      regNo: 'JEE26-0001',
      name: 'Rohit Sharma',
      program: 'JEE 2 Year',
      center: 'Gandhipuram',
      batchName: 'JEE 2026 - Phase 1',
      status: 'Enrolled',
    },
  ];

  // Dummy batches
  batches = [
    { id: 1, name: 'JEE 2026 - Phase 1' },
    { id: 2, name: 'NEET 2025 - Regular' },
  ];

  batchOptions = this.batches.map((b) => ({
    label: b.name,
    value: b.id,
  }));

  // list-table columns
  columns = [
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'name', label: 'Student', sortable: true },
    { key: 'program', label: 'Program', sortable: true },
    { key: 'center', label: 'Centre', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
  ];

  // actions
  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-user-plus',
      tooltip: 'Enroll',
      color: '#2563EB',
      callback: (row: any) => this.openEnroll(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-user-xmark',
      tooltip: 'Un-enroll',
      color: '#D42B2B',
      callback: (row: any) => this.unEnroll(row),
      visible: (row: any) => row.status === 'Enrolled',
    },
  ];

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Enrollment' }]);
  }

  ngOnInit(): void {
    this.enrollForm = this.fb.group({
      program: [{ value: '', disabled: true }, Validators.required],
      center: [{ value: '', disabled: true }, Validators.required],
      batchId: [null, Validators.required],
    });
  }

  openEnroll(row: any): void {
    this.selected = row;
    this.enrollForm.reset({
      program: row.program,
      center: row.center,
      batchId: null,
    });
    this.enrollForm.get('program')?.disable();
    this.enrollForm.get('center')?.disable();
    this.showEnroll = true;
    document.body.classList.add('modal-open');
  }

  closeEnroll(): void {
    this.showEnroll = false;
    this.selected = null;
    document.body.classList.remove('modal-open');
  }

  confirmEnroll(): void {
    if (this.enrollForm.invalid || !this.selected) return;

    const batchId = this.enrollForm.value.batchId;
    const batch = this.batches.find((b) => b.id === batchId);

    this.selected.batchName = batch?.name || '';
    this.selected.status = 'Enrolled';

    this.alert.success('Student enrolled successfully (dummy).');
    this.closeEnroll();
  }

  unEnroll(row: any): void {
    row.batchName = null;
    row.status = 'Not Enrolled';
    this.alert.success('Student un-enrolled (dummy).');
  }
}

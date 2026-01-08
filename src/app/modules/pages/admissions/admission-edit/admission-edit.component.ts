import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-admission-edit',
  standalone: false,
  templateUrl: './admission-edit.component.html',
  styleUrl: './admission-edit.component.scss'
})
export class AdmissionEditComponent implements OnChanges {
  @Input() admission: any;
  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  loading = false;
  form!: FormGroup;
  
  constructor(
    private fb: FormBuilder,
    private api: CommonapiService,
    private alert: AlertService
  ) {
    this.form = this.fb.group({
    studentName: ['', [Validators.required]],
    studentPhone: ['', [Validators.required]],
    studentEmail: [''],
    parentName: [''],
    parentPhone: [''],
    address: [''],
    city: [''],
    centerName: ['', [Validators.required]],
    programName: ['', [Validators.required]],
    programCode: [''],
    batchName: [''],
    classLabel: [''],
  });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['admission'] && this.admission) {
      this.patchFromAdmission();
    }
  }

  private pickTenantId(): string {
    const t1 = (localStorage.getItem('entiId') || '').trim();
    const t2 = (localStorage.getItem('tenantId') || '').trim();
    return t1 || t2;
  }

  private pickUserId(): string {
    return String(localStorage.getItem('userId') || '').trim();
  }

  private patchFromAdmission(): void {
    const a = this.admission;
    this.form.patchValue({
      studentName: a?.student?.name || '',
      studentPhone: a?.student?.phone || '',
      studentEmail: a?.student?.email || '',
      parentName: a?.student?.parentName || '',
      parentPhone: a?.student?.parentPhone || '',
      address: a?.student?.address || '',
      city: a?.student?.city || '',
      centerName: a?.academics?.centreName || a?.centerName || '',
      programName: a?.academics?.programName || a?.programName || '',
      programCode: a?.programCode || '',
      batchName: a?.academics?.batchName || a?.batchName || '',
      classLabel: a?.academics?.className || a?.classLabel || '',
    }, { emitEvent: false });
  }

  save(): void {
    if (this.loading) return;
    const tenantId = this.pickTenantId();
    const userId = this.pickUserId();
    const admissionId = String(this.admission?.admissionId || '').trim();
    if (!tenantId || !userId) {
      this.alert.error('tenantId/userId missing. Please login again.');
      return;
    }
    if (!admissionId) {
      this.alert.error('admissionId missing');
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.alert.warning('Please fill mandatory fields');
      return;
    }
    const v = this.form.getRawValue();
    const body: any = {
      entiId: tenantId,
      userId,
      admissionId,
      student: {
        name: v.studentName,
        phone: v.studentPhone,
        email: v.studentEmail,
        parentName: v.parentName,
        parentPhone: v.parentPhone,
        address: v.address,
        city: v.city,
      },
      centerName: v.centerName,
      programName: v.programName,
      programCode: v.programCode,
      batchName: v.batchName,
      classLabel: v.classLabel,
    };
    this.loading = true;
    this.api.fetchData(body, 'admi', 'update').subscribe({
      next: (resp: any) => {
        this.loading = false;
        if (!resp?.status) return this.alert.error(resp?.message || 'Failed to update admission');
        this.saved.emit();
      },
      error: () => {
        this.loading = false;
        this.alert.error('Failed to update admission');
      }
    });
  }

  close(): void {
    this.cancel.emit();
  }
}
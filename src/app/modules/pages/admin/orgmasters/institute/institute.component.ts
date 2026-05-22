import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { InstituteService } from '../../../../../service/admin/orgmasters/institution.service';

@Component({
  selector: 'app-institute',
  standalone: false,
  templateUrl: './institute.component.html',
  styleUrl: './institute.component.scss',
})
export class InstituteComponent implements OnInit {
  instituteForm!: FormGroup;
  showForm = false;
  entiId: any;
  instituteInfo: any = {};

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService,
    private instituteService: InstituteService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Org Configs' },
      { label: 'Institute' },
    ]);
  }

  cancel(): void {
    this.showForm = false;
  }

  ngOnInit(): void {
    this.instituteForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      addressLine1: ['', Validators.required],
      addressLine2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      isActive: [true],
    });
    this.loadInstitute();
  }

  loadInstitute(): void {
    this.instituteService.viewInstitute(this.entiId).subscribe((res) => {
      const d = res.data;
      this.instituteInfo = {
        name: d.tenantName,
        code: d.tenantCode,
        email: d.email,
        phone: d.phone,
        addressLine1: d.entAddress1,
        addressLine2: d.entAddress2,
        city: d.entCity,
        state: d.entState,
        pincode: d.entZip,
        status: d.status,
      };
    });
  }

  openEdit(): void {
    this.instituteForm.patchValue({
      ...this.instituteInfo,
      isActive: this.instituteInfo.status === 'Active',
    });
    this.showForm = true;
  }

  save(): void {
    if (this.instituteForm.invalid) {
      this.instituteForm.markAllAsTouched();
      return;
    }
    const f = this.instituteForm.value;
    const payload = {
      entiId: this.entiId,
      tenantName: f.name,
      tenantCode: f.code,
      email: f.email,
      phone: f.phone,
      contactName: f.email, 
      Address1: f.addressLine1,
      Address2: f.addressLine2,
      City: f.city,
      State: f.state,
      entZip: f.pincode,
      status: f.isActive ? 'Active' : 'Inactive',
    };

    this.instituteService.updateInstitute(payload).subscribe(() => {
      this.alertService.success('Institute updated successfully');
      this.showForm = false;
      this.loadInstitute();
    });
  }
}

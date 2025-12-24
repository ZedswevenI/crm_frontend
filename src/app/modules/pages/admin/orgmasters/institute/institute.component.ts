import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { InstituteService } from '../../../../../service/admin/orgmasters/institution.service';

@Component({
  selector: 'app-institute',
  standalone: false,
  templateUrl: './institute.component.html',
  styleUrl: './institute.component.scss'
})
export class InstituteComponent implements OnInit {

  instituteForm!: FormGroup;
  showForm = false;

  entiId : any;

  instituteInfo: any = {};

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService,
    private instituteService: InstituteService
  ) {
    this.entiId = localStorage.getItem('tenantId')
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Institute Information' }
    ]);
  }

  // =========================
  // INIT
  // =========================
  ngOnInit(): void {
    this.instituteForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      addressLine1: ['', Validators.required],
      addressLine2: [''],
      contactEmail: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      isActive: [true]
    });

    this.loadInstitute();
  }

  // =========================
  // VIEW
  // =========================
  loadInstitute(): void {
    this.instituteService.viewInstitute(this.entiId).subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alertService.error(res?.message || 'Failed to load institute');
          return;
        }

        const d = res.data;

        // Map API → UI object
        this.instituteInfo = {
          name: d.tenantName,
          code: d.tenantCode,
          city: d.entCity,
          state: d.entState,
          pincode: d.entZip,
          addressLine1: d.entAddress1,
          addressLine2: d.entAddress2,
          contactEmail: d.email,
          phone: d.phone,
          isActive: d.status === 'Active'
        };
      },
      error: () => this.alertService.error('Server error while loading institute')
    });
  }

  // =========================
  // OPEN EDIT
  // =========================
  openEdit(): void {
    this.instituteForm.patchValue(this.instituteInfo);
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  // =========================
  // UPDATE
  // =========================
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
      contactName: f.contactEmail, // backend expects contactName
      Address1: f.addressLine1,
      Address2: f.addressLine2,
      City: f.city,
      State: f.state,
      entZip: f.pincode,
      status: f.isActive ? 'Active' : 'Inactive'
    };

    this.instituteService.updateInstitute(payload).subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alertService.error(res?.message || 'Update failed');
          return;
        }

        this.alertService.success('Institute information updated successfully');
        this.showForm = false;
        this.loadInstitute();
      },
      error: () => this.alertService.error('Server error while updating institute')
    });
  }
}

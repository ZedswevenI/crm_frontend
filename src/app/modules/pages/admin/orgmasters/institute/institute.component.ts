import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';

@Component({
  selector: 'app-institute',
  standalone: false,
  templateUrl: './institute.component.html',
  styleUrl: './institute.component.scss'
})
export class InstituteComponent implements OnInit {
  instituteForm!: FormGroup;
  showForm = false;

  // Single institute info object (instead of data[])
  instituteInfo: any = {
    name: 'Z7i Institute',
    code: 'Z7I-HO',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641002',
    addressLine1: '123, Avinashi Road',
    addressLine2: 'Near XYZ Signal',
    contactEmail: 'info@z7iinstitute.com',
    phone: '9876543210',
    isActive: true
  };

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Institute Information' }
    ]);
  }

  ngOnInit(): void {
    this.instituteForm = this.fb.group({
      name: [this.instituteInfo.name, Validators.required],
      code: [this.instituteInfo.code, Validators.required],
      city: [this.instituteInfo.city, Validators.required],
      state: [this.instituteInfo.state, Validators.required],
      pincode: [
        this.instituteInfo.pincode,
        [Validators.required, Validators.pattern(/^\d{6}$/)]
      ],
      addressLine1: [this.instituteInfo.addressLine1, Validators.required],
      addressLine2: [this.instituteInfo.addressLine2],
      contactEmail: [
        this.instituteInfo.contactEmail,
        [Validators.required, Validators.email]
      ],
      phone: [
        this.instituteInfo.phone,
        [Validators.required, Validators.pattern(/^\d{10}$/)]
      ],
      isActive: [this.instituteInfo.isActive]
    });
  }

  openEdit(): void {
    // Ensure form is synced with current info
    this.instituteForm.reset({
      name: this.instituteInfo.name,
      code: this.instituteInfo.code,
      city: this.instituteInfo.city,
      state: this.instituteInfo.state,
      pincode: this.instituteInfo.pincode,
      addressLine1: this.instituteInfo.addressLine1,
      addressLine2: this.instituteInfo.addressLine2,
      contactEmail: this.instituteInfo.contactEmail,
      phone: this.instituteInfo.phone,
      isActive: this.instituteInfo.isActive
    });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.instituteForm.invalid) {
      this.instituteForm.markAllAsTouched();
      return;
    }

    const value = this.instituteForm.value;

    // Update single institute info
    this.instituteInfo = {
      ...this.instituteInfo,
      ...value
    };

    this.alertService.success('Institute information updated successfully');
    this.showForm = false;
  }
}

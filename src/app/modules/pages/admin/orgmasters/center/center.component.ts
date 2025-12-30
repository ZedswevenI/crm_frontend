import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CenterService } from '../../../../../service/admin/orgmasters/center.service';

@Component({
  selector: 'app-center',
  standalone: false,
  templateUrl: './center.component.html',
  styleUrl: './center.component.scss'
})
export class CenterComponent implements OnInit {

  centerForm!: FormGroup;
  centerData: any[] = [];

  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: string | null = null;

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  // Static entiId (as per backend requirement)
  entiId : any;

  // Dummy institute data (replace with API later if needed)
  institutes = [
    { id: 1, name: 'Z7i Institute - Main' },
    { id: 2, name: 'Z7i Institute - Chennai' }
  ];

  instituteOptions = this.institutes.map(i => ({
    label: i.name,
    value: i.id
  }));

  columns = [
    { key: 'centerName', label: 'Center Name', sortable: false },
    { key: 'centerCode', label: 'Code', sortable: false },
    { key: 'city', label: 'City', sortable: false },
    { key: 'state', label: 'State', sortable: false },
    { key: 'status', label: 'Status', sortable: false }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (row: any) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      hoverColor: '#D42B2B',
      callback: (row: any) => this.openDelete(row)
    }
  ];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService,
    private centerService: CenterService
  ) {
    this.entiId = localStorage.getItem('tenantId')
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Centers' }
    ]);
  }

  // ===============================
  // INIT
  // ===============================
  ngOnInit(): void {
    this.centerForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      // instituteId: [null, Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      isActive: [true],
      // Dynamic additional fields
     
      contactName: ['', Validators.required],
      address1: ['', Validators.required],
      address2: ['', Validators.required],
      area: ['', Validators.required],
       phone: ['', Validators.required],
      pincode: ['', Validators.required]
    });

    this.loadCenters();
  }

  // ===============================
  // LIST
  // ===============================
  loadCenters(): void {
    this.centerService.listCenters(this.entiId).subscribe({
      next: (res) => {
        this.centerData = res?.data || [];
      },
      error: (err) => this.alertService.error(err)
    });
  }

  // ===============================
  // ADD
  // ===============================
  add(): void {
    this.formMode = 'create';
    this.editingId = null;

    this.centerForm.reset({
      isActive: true
    });

    this.showForm = true;
  }

  // ===============================
  // EDIT
  // ===============================
  edit(row: any): void {
    console.log("Row data ", row);

    this.formMode = 'edit';
    this.editingId = row.recId || row._id;

    this.centerForm.patchValue({
      name: row.centerName,
      code: row.centerCode,
      instituteId: row.instituteId,
      city: row.city,
      state: row.state,
      isActive: row.status === 'Active',
      phone: row.phone,
      contactName: row.cntatName,
      address1: row.address1,
      address2: row.address2,
      area: row.area,
      pincode: row.pincode
    });

    this.showForm = true;
  }

  // ===============================
  // CANCEL
  // ===============================
  cancel(): void {
    this.showForm = false;
  }

  // ===============================
  // SAVE (CREATE / UPDATE)
  // ===============================
  save(): void {
    if (this.centerForm.invalid) {
      this.centerForm.markAllAsTouched();
      return;
    }

    const f = this.centerForm.value;

    const payload: any = {
      entiId: this.entiId,
      centerName: f.name,
      centerCode: f.code,
      phone: f.phone,
      contactName: f.contactName,
      address1: f.address1,
      address2: f.address2,
      area: f.area,
      city: f.city,
      state: f.state,
      country: 'India',
      pincode: f.pincode,
      status: f.isActive ? 'Active' : 'Inactive'
    };

    const api$ =
      this.formMode === 'create'
        ? this.centerService.createCenter(payload)
        : this.centerService.updateCenter({
          ...payload,
          recId: this.editingId
        });
    api$.subscribe({
      next: (res: any) => {
        console.log("respons ",res);
        
        if (res?.status === false || res?.success === false && !res.data) {
          this.alertService.error(res?.message || 'Operation failed');
          return; 
        }
        this.alertService.success(
          this.formMode === 'create'
            ? 'Center created successfully'
            : 'Center updated successfully'
        );

        this.showForm = false;
        this.loadCenters();
      },
      error: (err) => {
        this.alertService.error(err || 'Server error');
      }
    });

  }

  // ===============================
  // DELETE
  // ===============================
  openDelete(row: any): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete center "${row.centerName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;

    if (!confirmed || !this.deleteTarget) return;

    this.centerService
      .deleteCenter(this.entiId, this.deleteTarget._id)
      .subscribe({
        next: () => {
          this.alertService.success('Center deleted');
          this.loadCenters();
        },
        error: (err) => this.alertService.error(err)
      });

    this.deleteTarget = null;
  }
}

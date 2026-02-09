import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-centerview',
  standalone: false,
  templateUrl: './centerview.component.html',
  styleUrl: './centerview.component.scss',
})
export class CenterviewComponent implements OnInit {
  entiId: any;
  centerRecId: string = '';
  venueForm!: FormGroup;
  venueSaving = false;
  center: any = {};
  loadingCenter = false;
  venues: any[] = [];
  venueTotalRecords = 0;
  venueLoading = false;
  venueColumns = [
    { key: 'venueName', label: 'Venue Name', sortable: false },
    { key: 'capacity', label: 'Capacity', sortable: false },
    { key: 'area', label: 'Area', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
  ];
  venueActions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (row: any) => this.editVenue(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      hoverColor: '#D42B2B',
      callback: (row: any) => this.openDeleteVenue(row),
    },
  ];
  showVenueForm = false;
  venueFormMode: 'create' | 'edit' = 'create';
  editingVenueId: string | null = null;
  deleteVenueModalVisible = false;
  deleteVenueTarget: any | null = null;
  deleteVenueMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private api: CommonapiService,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Centers' },
      { label: 'View' },
    ]);
  }

  ngOnInit() {
    this.centerRecId = String(
      this.route.snapshot.paramMap.get('id') || '',
    ).trim();
    this.venueForm = this.fb.group({
      venueName: ['', Validators.required],
      capacity: [null, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
      venueCode: ['', Validators.required],
      address1: ['', Validators.required],
      address2: [''],
      city: ['', Validators.required],
      area: ['', Validators.required],
      state: ['', Validators.required],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      phone: ['', [Validators.pattern(/^\d{10}$/)]],
      isActive: [true],
    });
    this.loadCenter();
  }

  back() {
    this.router.navigate(['/app/admin/masters/centers']);
  }

  loadCenter() {
    if (!this.centerRecId) return;
    this.loadingCenter = true;
    this.api
      .fetchData(
        { entiId: this.entiId, recId: this.centerRecId },
        'ims/center',
        'view',
      )
      .subscribe({
        next: (res: any) => {
          this.loadingCenter = false;
          if (res?.status === false) {
            this.alert.error(res?.message || 'Failed to load center');
            return;
          }
          this.center = res?.data || {};
        },
        error: () => {
          this.loadingCenter = false;
          this.alert.error('Server error while loading center');
        },
      });
  }

  fetchVenues(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: string;
  }) {
    console.log('ce', this.centerRecId);
    this.venueLoading = true;
    const query: any = {
      page: params.page,
      limit: params.pageSize || 10,
    };
    if (params.search) query.search = params.search;
    const qs = Object.keys(query)
      .map((k) => `${k}=${encodeURIComponent(query[k])}`)
      .join('&');
    const body = { entiId: this.entiId, centerRecId: this.centerRecId };
    this.api.fetchData(body, 'ims', `venue/list?${qs}`).subscribe({
      next: (res: any) => {
        this.venueLoading = false;
        if (res?.status === false) {
          this.alert.error(res?.message || 'Failed to load venues');
          return;
        }
        this.venues = res?.data || [];
        this.venueTotalRecords = res?.count || 0;
      },
      error: () => {
        this.venueLoading = false;
        this.alert.error('Server error while loading venues');
      },
    });
  }

  addVenue() {
    this.venueFormMode = 'create';
    this.editingVenueId = null;
    this.venueForm.reset({ isActive: true });
    this.showVenueForm = true;
  }

  editVenue(row: any) {
    this.venueFormMode = 'edit';
    this.editingVenueId = row?._id || null;
    this.venueForm.patchValue({
      venueName: row.venueName,
      capacity: row.capacity,
      isActive: row.status === 'Active',
      address1: row.address1 || '',
      address2: row.address2 || '',
      area: row.area || '',
      city: row.city || '',
      state: row.state || '',
      pincode: row.pincode || '',
    });

    this.showVenueForm = true;
  }

  closeVenueModal() {
    this.showVenueForm = false;
  }

  saveVenue() {
    if (this.venueSaving) return;
    if (this.venueForm.invalid) {
      this.venueForm.markAllAsTouched();
      return;
    }
    this.venueSaving = true;
    const f = this.venueForm.value;
    const payload: any = {
      entiId: this.entiId,
      centerRecId: this.centerRecId,
      venueName: f.venueName,
      capacity: f.capacity,
      address1: f.address1,
      address2: f.address2,
      area: f.area,
      city: f.city,
      state: f.state,
      pincode: f.pincode,
      status: f.isActive ? 'Active' : 'Inactive',
    };
    const path =
      this.venueFormMode === 'create' ? 'venue/create' : 'venue/edit';
    if (this.venueFormMode === 'edit') payload.recId = this.editingVenueId;
    this.api
      .fetchData(payload, 'ims', path)
      .pipe(finalize(() => (this.venueSaving = false)))
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Operation failed');
            return;
          }
          this.alert.success(
            this.venueFormMode === 'create'
              ? 'Venue created successfully'
              : 'Venue updated successfully',
          );
          this.showVenueForm = false;
          this.fetchVenues({ page: 1, pageSize: 10 });
        },
        error: () => this.alert.error('Server error'),
      });
  }

  openDeleteVenue(row: any) {
    this.deleteVenueTarget = row;
    this.deleteVenueMessage = `Are you sure you want to delete venue "${row?.venueName || ''}"?`;
    this.deleteVenueModalVisible = true;
  }

  onDeleteVenueClosed(confirmed: boolean) {
    this.deleteVenueModalVisible = false;
    if (!confirmed || !this.deleteVenueTarget) return;
    const payload = { entiId: this.entiId, recId: this.deleteVenueTarget._id };
    this.api.fetchData(payload, 'ims', 'venue/delete').subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alert.error(res?.message || 'Delete failed');
          return;
        }
        this.alert.success('Venue deleted');
        this.fetchVenues({ page: 1, pageSize: 10 });
      },
      error: () => this.alert.error('Server error'),
    });
    this.deleteVenueTarget = null;
  }
}

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';

@Component({
  selector: 'app-settings',
  standalone: false,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  settingsForm!: FormGroup;

  // to support "Reset Changes" (without going to real API yet)
  private lastSavedValue: any;

  academicYearOptions = [
    { label: '2024-2025', value: '2024-2025' },
    { label: '2025-2026', value: '2025-2026' },
    { label: '2026-2027', value: '2026-2027' }
  ];

  dateFormatOptions = [
    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }
  ];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Settings' }
    ]);
  }

  ngOnInit(): void {
    this.settingsForm = this.fb.group({
      // General
      displayName: ['Z7i Institute', Validators.required],
      academicYear: ['2024-2025', Validators.required],
      dateFormat: ['DD/MM/YYYY', Validators.required],
      timeZone: ['Asia/Kolkata', Validators.required],

      // Admission
      enableOnline: [true],
      autoGenerateEnrolNo: [true],
      enrolPrefix: ['Z7I-ENR', Validators.required],
      allowProfileEdit: [true],

      // Communication
      enableEmail: [true],
      enableWhatsapp: [true],
      enableSms: [false],
      emailFrom: ['noreply@z7iinstitute.com', [Validators.required, Validators.email]],
      smsSenderId: ['Z7IINS']
    });

    // Dummy "last saved" snapshot
    this.lastSavedValue = this.settingsForm.value;
  }

  save(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    const value = this.settingsForm.value;

    // here you’ll call backend later
    console.log('Settings to save:', value);

    this.lastSavedValue = value;
    this.alertService.success('Settings saved successfully');
  }

  resetToSaved(): void {
    this.settingsForm.reset(this.lastSavedValue);
  }
}

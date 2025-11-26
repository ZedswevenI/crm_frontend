import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-sample',
  standalone: false,
  templateUrl: './sample.component.html',
  styleUrl: './sample.component.scss'
})
export class SampleComponent {
form! : FormGroup;

//select
field_options: any[] = [
  { label: 'Text Field', value: 'text' },
  { label: 'Number Field', value: 'number' }
];

//multiselect
field_options2 = [
  { label: 'Text Field', value: 'text' },
  { label: 'Number Field', value: 'number' },
  { label: 'Date Field', value: 'date' }
];

//radiobutton
radioOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' }
];

constructor(private fb: FormBuilder){}

ngOnInit(): void{
  this.form = this.fb.group({
    location: ['',[Validators.required]],
    type: ['', [Validators.required]],
    check: ['', [Validators.required]],
    selectedFields: [[], Validators.required],
    gender: ['', [Validators.required]],
  })
}
}

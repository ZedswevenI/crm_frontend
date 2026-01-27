import { Component, Input, forwardRef, OnInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'checkbox',
  standalone: false,
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true
    }
  ]
})
export class CheckboxComponent implements ControlValueAccessor, OnInit {
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() control: AbstractControl | null = null;
  @Input() value: any = true;
  @Input() id: string = 'checkboxField';

  checked: boolean = false;

  ngOnInit() {
    if (!this.id) {
      this.id = 'chk-' + this.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
  }

  onChange = (_: any) => {};
  onTouched = () => {};

  writeValue(obj: any): void {
    this.checked = !!obj;
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  onCheckboxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.checked = input.checked;
    this.onChange(this.checked ? this.value : false);
  }
}

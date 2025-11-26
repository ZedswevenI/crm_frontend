import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'radiobutton',
  standalone: false,
  templateUrl: './radiobutton.component.html',
  styleUrl: './radiobutton.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadiobuttonComponent),
      multi: true
    }
  ]
})
export class RadiobuttonComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() options: { label: string; value: any }[] = [];
  @Input() control: AbstractControl | null = null;
  @Input() name: string = 'radioGroup';

  value: any = null;

  onChange = (_: any) => { };
  onTouched = () => { };

  writeValue(obj: any): void {
    this.value = obj;
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  onRadioChange(val: any) {
    this.value = val;
    this.onChange(val);
  }
}

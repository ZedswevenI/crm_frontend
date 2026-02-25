import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'togglebtn',
  standalone: false,
  templateUrl: './togglebutton.component.html',
  styleUrl: './togglebutton.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TogglebuttonComponent),
      multi: true
    }
  ]
})
export class TogglebuttonComponent implements ControlValueAccessor {
  @Input() leftLabel: string = '';
  @Input() rightLabel: string = '';
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() control: AbstractControl | null = null;
  @Input() id: string = 'toggleSwitch';

  value: boolean = false;
  onChange = (_: boolean) => {};
  onTouched = () => {};

  writeValue(obj: any): void {
    this.value = !!obj;
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  onToggleChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.value = input.checked;
    this.onChange(this.value);
  }
}

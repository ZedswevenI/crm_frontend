import { Component, Input, forwardRef, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'selectbox',
  standalone: false,
  templateUrl: './selectbox.component.html',
  styleUrl: './selectbox.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectboxComponent),
      multi: true
    }
  ]
})
export class SelectboxComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() placeholder: string = 'Select';
  @Input() required: boolean = false;
  @Input() options: any[] = [];
  @Input() optionLabel: string = 'label';
  @Input() optionValue: string = 'value';
  @Input() control: AbstractControl | null = null;
  @Input() disabled: boolean = false;
  @Output() selectionChange = new EventEmitter<any>();
  value: any = '';
  onChange = (_: any) => {};
  onTouched = () => {};

  writeValue(value: any): void {
    if (value === '') {
      this.value = null;
    } else {
      this.value = value;
    }
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  onSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.value = select.value;
    this.onChange(this.value);
    this.selectionChange.emit(this.value);
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  getLabel(opt: any) {
    return opt[this.optionLabel];
  }
}

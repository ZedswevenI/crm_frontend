import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  NgModule,
  effect,
  inject,
  input,
  linkedSignal,
  setClassMetadata,
  untracked,
  ɵɵdefineComponent,
  ɵɵdefineInjector,
  ɵɵdefineNgModule,
  ɵɵprojection,
  ɵɵprojectionDef
} from "./chunk-ISE7KKRH.js";
import "./chunk-WPM5VTLQ.js";
import "./chunk-PEBH6BBU.js";
import "./chunk-4S3KYZTJ.js";
import {
  __spreadValues
} from "./chunk-4MWRP73S.js";

// node_modules/angular-tabler-icons/fesm2022/angular-tabler-icons.mjs
var _c0 = ["*"];
var OPTIONS_TOKEN = new InjectionToken("OPTIONS_TOKEN");
function upperCamelCase(str) {
  return str.toLowerCase().replace(/(?:^\w|[A-Z]|\b\w)/g, (firstLetter) => {
    return firstLetter.toUpperCase();
  }).replace(/[-_]/g, "");
}
var TablerIconComponent = class _TablerIconComponent {
  constructor() {
    this.#elem = inject(ElementRef);
    this.#options = inject(OPTIONS_TOKEN);
    this.name = input.required();
    this.#svg = linkedSignal(() => this.#getSvgIcon(this.name()));
    this.setNativeSvg = effect(() => {
      const svg = this.#svg();
      if (!svg) {
        return;
      }
      untracked(() => {
        this.#elem.nativeElement.innerHTML = svg;
      });
    });
  }
  #elem;
  #options;
  #svg;
  /**
   * Retrieves the SVG markup for a given icon name from the configured icon sets.
   *
   * @param iconName - The name of the icon to retrieve in kebab-case format
   * @returns The SVG markup string for the icon, or an empty string if not found
   *
   * @remarks
   * This method:
   * - Merges all icon sets from the configured options
   * - Converts the icon name to upper camel case and prepends "Icon"
   * - Returns empty string if icon name is undefined
   * - Logs a warning if icon is not found (unless warnings are ignored in options)
   */
  #getSvgIcon(iconName) {
    const icons = Object.assign({}, ...this.#options.map((option) => option.icons));
    if (!iconName) {
      return "";
    }
    const icon = `Icon${upperCamelCase(iconName)}`;
    const svg = icons?.[icon] ?? "";
    if (!svg && !this.#options.some((option) => option.ignoreWarnings)) {
      console.warn(`Tabler Icon not found: ${iconName}

         Refer to documentation on https://github.com/pierreavn/angular-tabler-icons`);
    }
    return svg;
  }
  static {
    this.ɵfac = function TablerIconComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _TablerIconComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _TablerIconComponent,
      selectors: [["i-tabler"], ["tabler-icon"]],
      inputs: {
        name: [1, "name"]
      },
      ngContentSelectors: _c0,
      decls: 1,
      vars: 0,
      template: function TablerIconComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      styles: ["[_nghost-%COMP%]{display:inline-block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round}"],
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(TablerIconComponent, [{
    type: Component,
    args: [{
      selector: "i-tabler, tabler-icon",
      template: `<ng-content />`,
      changeDetection: ChangeDetectionStrategy.OnPush,
      styles: [":host{display:inline-block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round}\n"]
    }]
  }], null, null);
})();
var TablerIconsModule = class _TablerIconsModule {
  constructor() {
    this.options = inject(OPTIONS_TOKEN, {
      optional: true
    });
    if (!this.options) {
      throw new Error(`No icon provided. Make sure to use 'TablerIconsModule.pick({ ... })' when importing the module
Refer to documentation on https://github.com/pierreavn/angular-tabler-icons`);
    }
  }
  /**
   * Initialize module with given icons and options
   * @param icons
   * @returns Module with options
   */
  static pick(icons, options) {
    return {
      ngModule: _TablerIconsModule,
      providers: [{
        provide: OPTIONS_TOKEN,
        useValue: __spreadValues({
          icons
        }, options),
        multi: true
      }]
    };
  }
  static {
    this.ɵfac = function TablerIconsModule_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _TablerIconsModule)();
    };
  }
  static {
    this.ɵmod = ɵɵdefineNgModule({
      type: _TablerIconsModule,
      imports: [TablerIconComponent],
      exports: [TablerIconComponent]
    });
  }
  static {
    this.ɵinj = ɵɵdefineInjector({});
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(TablerIconsModule, [{
    type: NgModule,
    args: [{
      imports: [TablerIconComponent],
      exports: [TablerIconComponent]
    }]
  }], () => [], null);
})();
function provideTablerIcons(icons, options) {
  return [{
    provide: OPTIONS_TOKEN,
    useValue: __spreadValues({
      icons
    }, options),
    multi: true
  }];
}
export {
  TablerIconComponent,
  TablerIconsModule,
  provideTablerIcons
};
//# sourceMappingURL=angular-tabler-icons.js.map

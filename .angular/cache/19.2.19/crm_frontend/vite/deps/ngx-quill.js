import {
  DomSanitizer
} from "./chunk-AEFK3VBE.js";
import "./chunk-MV5JBCE2.js";
import {
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR
} from "./chunk-TLLCW3DX.js";
import "./chunk-BYXAULKM.js";
import {
  isPlatformServer
} from "./chunk-A5BGWEZH.js";
import {
  takeUntilDestroyed
} from "./chunk-66FNNPW4.js";
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  EventEmitter,
  Injectable,
  InjectionToken,
  NgModule,
  NgZone,
  Output,
  PLATFORM_ID,
  Renderer2,
  SecurityContext,
  ViewEncapsulation,
  forwardRef,
  inject,
  input,
  makeEnvironmentProviders,
  setClassMetadata,
  signal,
  ɵɵInheritDefinitionFeature,
  ɵɵNgOnChangesFeature,
  ɵɵProvidersFeature,
  ɵɵadvance,
  ɵɵclassMap,
  ɵɵconditional,
  ɵɵdefineComponent,
  ɵɵdefineDirective,
  ɵɵdefineInjectable,
  ɵɵdefineInjector,
  ɵɵdefineNgModule,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetInheritedFactory,
  ɵɵprojection,
  ɵɵprojectionDef,
  ɵɵproperty,
  ɵɵsanitizeHtml,
  ɵɵtemplate
} from "./chunk-ISE7KKRH.js";
import {
  defer,
  forkJoin,
  fromEvent,
  isObservable
} from "./chunk-WPM5VTLQ.js";
import "./chunk-PEBH6BBU.js";
import {
  Observable,
  Subscription,
  debounceTime,
  map,
  mergeMap,
  of,
  shareReplay,
  tap
} from "./chunk-4S3KYZTJ.js";
import {
  __async
} from "./chunk-4MWRP73S.js";

// node_modules/ngx-quill/fesm2022/ngx-quill-config.mjs
var defaultModules = {
  toolbar: [
    ["bold", "italic", "underline", "strike"],
    // toggled buttons
    ["blockquote", "code-block"],
    [{
      header: 1
    }, {
      header: 2
    }],
    // custom button values
    [{
      list: "ordered"
    }, {
      list: "bullet"
    }],
    [{
      script: "sub"
    }, {
      script: "super"
    }],
    // superscript/subscript
    [{
      indent: "-1"
    }, {
      indent: "+1"
    }],
    // outdent/indent
    [{
      direction: "rtl"
    }],
    // text direction
    [{
      size: ["small", false, "large", "huge"]
    }],
    // custom dropdown
    [{
      header: [1, 2, 3, 4, 5, 6, false]
    }],
    [{
      color: []
    }, {
      background: []
    }],
    // dropdown with defaults from theme
    [{
      font: []
    }],
    [{
      align: []
    }],
    ["clean"],
    // remove formatting button
    ["link", "image", "video"],
    // link and image, video
    ["table"]
  ]
};
var QUILL_CONFIG_TOKEN = new InjectionToken("config", {
  providedIn: "root",
  factory: () => ({
    modules: defaultModules
  })
});
var QuillConfigModule = class _QuillConfigModule {
  static forRoot(config) {
    return {
      ngModule: _QuillConfigModule,
      providers: [{
        provide: QUILL_CONFIG_TOKEN,
        useValue: config
      }]
    };
  }
  static {
    this.ɵfac = function QuillConfigModule_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _QuillConfigModule)();
    };
  }
  static {
    this.ɵmod = ɵɵdefineNgModule({
      type: _QuillConfigModule
    });
  }
  static {
    this.ɵinj = ɵɵdefineInjector({});
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(QuillConfigModule, [{
    type: NgModule
  }], null, null);
})();
var provideQuillConfig = (config) => makeEnvironmentProviders([{
  provide: QUILL_CONFIG_TOKEN,
  useValue: config
}]);

// node_modules/ngx-quill/fesm2022/ngx-quill.mjs
var _c0 = [[["", "above-quill-editor-toolbar", ""]], [["", "quill-editor-toolbar", ""]], [["", "below-quill-editor-toolbar", ""]]];
var _c1 = ["[above-quill-editor-toolbar]", "[quill-editor-toolbar]", "[below-quill-editor-toolbar]"];
function QuillEditorComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "div", 0);
  }
}
function QuillEditorComponent_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "div", 0);
  }
}
var getFormat = (format, configFormat) => {
  const passedFormat = format || configFormat;
  return passedFormat || "html";
};
var raf$ = () => {
  return new Observable((subscriber) => {
    const rafId = requestAnimationFrame(() => {
      subscriber.next();
      subscriber.complete();
    });
    return () => cancelAnimationFrame(rafId);
  });
};
var QuillService = class _QuillService {
  constructor() {
    this.config = inject(QUILL_CONFIG_TOKEN) || {
      modules: defaultModules
    };
    this.quill$ = defer(() => __async(this, null, function* () {
      if (!this.Quill) {
        const maybePatchedAddEventListener = document.addEventListener;
        document.addEventListener = document["__zone_symbol__addEventListener"] || document.addEventListener;
        const {
          Quill
        } = yield import("./ngx-quill-quill-CUw8Q_m0-WDPCKBR6.js");
        document.addEventListener = maybePatchedAddEventListener;
        this.Quill = Quill;
      }
      this.config.customOptions?.forEach((customOption) => {
        const newCustomOption = this.Quill.import(customOption.import);
        newCustomOption.whitelist = customOption.whitelist;
        this.Quill.register(newCustomOption, true, this.config.suppressGlobalRegisterWarning);
      });
      return new Promise((resolve) => {
        this.registerCustomModules(this.Quill, this.config.customModules, this.config.suppressGlobalRegisterWarning).subscribe(resolve);
      });
    })).pipe(shareReplay({
      bufferSize: 1,
      refCount: false
    }));
    this.registeredModules = /* @__PURE__ */ new Set();
  }
  getQuill() {
    return this.quill$;
  }
  /** @internal */
  beforeRender(Quill, customModules, beforeRender = this.config.beforeRender) {
    const sources = [this.registerCustomModules(Quill, customModules)];
    if (beforeRender) {
      sources.push(beforeRender());
    }
    return forkJoin(sources).pipe(map(() => Quill));
  }
  /** @internal */
  registerCustomModules(Quill, customModules, suppressGlobalRegisterWarning) {
    if (!Array.isArray(customModules)) {
      return of(Quill);
    }
    const sources = [];
    for (const customModule of customModules) {
      const {
        path,
        implementation: maybeImplementation
      } = customModule;
      if (this.registeredModules.has(path)) {
        continue;
      }
      this.registeredModules.add(path);
      if (isObservable(maybeImplementation)) {
        sources.push(maybeImplementation.pipe(tap((implementation) => {
          Quill.register(path, implementation, suppressGlobalRegisterWarning);
        })));
      } else {
        Quill.register(path, maybeImplementation, suppressGlobalRegisterWarning);
      }
    }
    return sources.length > 0 ? forkJoin(sources).pipe(map(() => Quill)) : of(Quill);
  }
  static {
    this.ɵfac = function QuillService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _QuillService)();
    };
  }
  static {
    this.ɵprov = ɵɵdefineInjectable({
      token: _QuillService,
      factory: _QuillService.ɵfac,
      providedIn: "root"
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(QuillService, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], null, null);
})();
var QuillEditorBase = class _QuillEditorBase {
  constructor() {
    this.format = input(void 0);
    this.theme = input(void 0);
    this.modules = input(void 0);
    this.debug = input(false);
    this.readOnly = input(false);
    this.placeholder = input(void 0);
    this.maxLength = input(void 0);
    this.minLength = input(void 0);
    this.required = input(false);
    this.formats = input(void 0);
    this.customToolbarPosition = input("top");
    this.sanitize = input(void 0);
    this.beforeRender = input(void 0);
    this.styles = input(null);
    this.registry = input(void 0);
    this.bounds = input(void 0);
    this.customOptions = input([]);
    this.customModules = input([]);
    this.trackChanges = input(void 0);
    this.classes = input(void 0);
    this.trimOnValidation = input(false);
    this.linkPlaceholder = input(void 0);
    this.compareValues = input(false);
    this.filterNull = input(false);
    this.debounceTime = input(void 0);
    this.defaultEmptyValue = input(null);
    this.onEditorCreated = new EventEmitter();
    this.onEditorChanged = new EventEmitter();
    this.onContentChanged = new EventEmitter();
    this.onSelectionChanged = new EventEmitter();
    this.onFocus = new EventEmitter();
    this.onBlur = new EventEmitter();
    this.onNativeFocus = new EventEmitter();
    this.onNativeBlur = new EventEmitter();
    this.disabled = false;
    this.toolbarPosition = signal("top");
    this.eventsSubscription = null;
    this.quillSubscription = null;
    this.elementRef = inject(ElementRef);
    this.cd = inject(ChangeDetectorRef);
    this.domSanitizer = inject(DomSanitizer);
    this.platformId = inject(PLATFORM_ID);
    this.renderer = inject(Renderer2);
    this.zone = inject(NgZone);
    this.service = inject(QuillService);
    this.destroyRef = inject(DestroyRef);
    this.valueGetter = input((quillEditor) => {
      let html = quillEditor.getSemanticHTML();
      if (this.isEmptyValue(html)) {
        html = this.defaultEmptyValue();
      }
      let modelValue = html;
      const format = getFormat(this.format(), this.service.config.format);
      if (format === "text") {
        modelValue = quillEditor.getText();
      } else if (format === "object") {
        modelValue = quillEditor.getContents();
      } else if (format === "json") {
        try {
          modelValue = JSON.stringify(quillEditor.getContents());
        } catch {
          modelValue = quillEditor.getText();
        }
      }
      return modelValue;
    });
    this.valueSetter = input((quillEditor, value) => {
      const format = getFormat(this.format(), this.service.config.format);
      if (format === "html") {
        const sanitize = [true, false].includes(this.sanitize()) ? this.sanitize() : this.service.config.sanitize || false;
        if (sanitize) {
          value = this.domSanitizer.sanitize(SecurityContext.HTML, value);
        }
        return quillEditor.clipboard.convert({
          html: value
        });
      } else if (format === "json") {
        try {
          return JSON.parse(value);
        } catch {
          return [{
            insert: value
          }];
        }
      }
      return value;
    });
    this.selectionChangeHandler = (range, oldRange, source) => {
      const trackChanges = this.trackChanges() || this.service.config.trackChanges;
      const shouldTriggerOnModelTouched = !range && !!this.onModelTouched && (source === "user" || trackChanges && trackChanges === "all");
      if (!this.onBlur.observed && !this.onFocus.observed && !this.onSelectionChanged.observed && !shouldTriggerOnModelTouched) {
        return;
      }
      this.zone.run(() => {
        if (range === null) {
          this.onBlur.emit({
            editor: this.quillEditor,
            source
          });
        } else if (oldRange === null) {
          this.onFocus.emit({
            editor: this.quillEditor,
            source
          });
        }
        this.onSelectionChanged.emit({
          editor: this.quillEditor,
          oldRange,
          range,
          source
        });
        if (shouldTriggerOnModelTouched) {
          this.onModelTouched();
        }
        this.cd.markForCheck();
      });
    };
    this.textChangeHandler = (delta, oldDelta, source) => {
      const text = this.quillEditor.getText();
      const content = this.quillEditor.getContents();
      let html = this.quillEditor.getSemanticHTML();
      if (this.isEmptyValue(html)) {
        html = this.defaultEmptyValue();
      }
      const trackChanges = this.trackChanges() || this.service.config.trackChanges;
      const shouldTriggerOnModelChange = (source === "user" || trackChanges && trackChanges === "all") && !!this.onModelChange;
      if (!this.onContentChanged.observed && !shouldTriggerOnModelChange) {
        return;
      }
      this.zone.run(() => {
        if (shouldTriggerOnModelChange) {
          const valueGetter = this.valueGetter();
          this.onModelChange(valueGetter(this.quillEditor));
        }
        this.onContentChanged.emit({
          content,
          delta,
          editor: this.quillEditor,
          html,
          oldDelta,
          source,
          text
        });
        this.cd.markForCheck();
      });
    };
    this.editorChangeHandler = (event, current, old, source) => {
      if (!this.onEditorChanged.observed) {
        return;
      }
      if (event === "text-change") {
        const text = this.quillEditor.getText();
        const content = this.quillEditor.getContents();
        let html = this.quillEditor.getSemanticHTML();
        if (this.isEmptyValue(html)) {
          html = this.defaultEmptyValue();
        }
        this.zone.run(() => {
          this.onEditorChanged.emit({
            content,
            delta: current,
            editor: this.quillEditor,
            event,
            html,
            oldDelta: old,
            source,
            text
          });
          this.cd.markForCheck();
        });
      } else {
        this.zone.run(() => {
          this.onEditorChanged.emit({
            editor: this.quillEditor,
            event,
            oldRange: old,
            range: current,
            source
          });
          this.cd.markForCheck();
        });
      }
    };
    this.destroyRef.onDestroy(() => {
      this.dispose();
      this.quillSubscription?.unsubscribe();
      this.quillSubscription = null;
    });
  }
  static normalizeClassNames(classes) {
    const classList = classes.trim().split(" ");
    return classList.reduce((prev, cur) => {
      const trimmed = cur.trim();
      if (trimmed) {
        prev.push(trimmed);
      }
      return prev;
    }, []);
  }
  ngOnInit() {
    this.toolbarPosition.set(this.customToolbarPosition());
  }
  ngAfterViewInit() {
    if (isPlatformServer(this.platformId)) {
      return;
    }
    this.quillSubscription = this.service.getQuill().pipe(mergeMap((Quill) => this.service.beforeRender(Quill, this.customModules(), this.beforeRender()))).subscribe((Quill) => {
      this.editorElem = this.elementRef.nativeElement.querySelector("[quill-editor-element]");
      const toolbarElem = this.elementRef.nativeElement.querySelector("[quill-editor-toolbar]");
      const modules = Object.assign({}, this.modules() || this.service.config.modules);
      if (toolbarElem) {
        modules.toolbar = toolbarElem;
      } else if (modules.toolbar === void 0) {
        modules.toolbar = defaultModules.toolbar;
      }
      let placeholder = this.placeholder() !== void 0 ? this.placeholder() : this.service.config.placeholder;
      if (placeholder === void 0) {
        placeholder = "Insert text here ...";
      }
      const styles = this.styles();
      if (styles) {
        Object.keys(styles).forEach((key) => {
          this.renderer.setStyle(this.editorElem, key, styles[key]);
        });
      }
      if (this.classes()) {
        this.addClasses(this.classes());
      }
      this.customOptions().forEach((customOption) => {
        const newCustomOption = Quill.import(customOption.import);
        newCustomOption.whitelist = customOption.whitelist;
        Quill.register(newCustomOption, true);
      });
      let bounds = this.bounds() && this.bounds() === "self" ? this.editorElem : this.bounds();
      if (!bounds) {
        bounds = this.service.config.bounds ? this.service.config.bounds : document.body;
      }
      let debug = this.debug();
      if (!debug && debug !== false && this.service.config.debug) {
        debug = this.service.config.debug;
      }
      let readOnly = this.readOnly();
      if (!readOnly && this.readOnly() !== false) {
        readOnly = this.service.config.readOnly !== void 0 ? this.service.config.readOnly : false;
      }
      let formats = this.formats();
      if (!formats && formats === void 0) {
        formats = this.service.config.formats ? [...this.service.config.formats] : this.service.config.formats === null ? null : void 0;
      }
      this.zone.runOutsideAngular(() => {
        this.quillEditor = new Quill(this.editorElem, {
          bounds,
          debug,
          formats,
          modules,
          placeholder,
          readOnly,
          registry: this.registry(),
          theme: this.theme() || (this.service.config.theme ? this.service.config.theme : "snow")
        });
        if (this.onNativeBlur.observed) {
          fromEvent(this.quillEditor.scroll.domNode, "blur").pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onNativeBlur.next({
            editor: this.quillEditor,
            source: "dom"
          }));
          const toolbar = this.quillEditor.getModule("toolbar");
          if (toolbar.container) {
            fromEvent(toolbar.container, "mousedown").pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => e.preventDefault());
          }
        }
        if (this.onNativeFocus.observed) {
          fromEvent(this.quillEditor.scroll.domNode, "focus").pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onNativeFocus.next({
            editor: this.quillEditor,
            source: "dom"
          }));
        }
        if (this.linkPlaceholder()) {
          const tooltip = this.quillEditor?.theme?.tooltip;
          const input2 = tooltip?.root?.querySelector("input[data-link]");
          if (input2?.dataset) {
            input2.dataset.link = this.linkPlaceholder();
          }
        }
      });
      if (this.content) {
        const format = getFormat(this.format(), this.service.config.format);
        if (format === "text") {
          this.quillEditor.setText(this.content, "silent");
        } else {
          const valueSetter = this.valueSetter();
          const newValue = valueSetter(this.quillEditor, this.content);
          this.quillEditor.setContents(newValue, "silent");
        }
        const history = this.quillEditor.getModule("history");
        history.clear();
      }
      this.setDisabledState();
      this.addQuillEventListeners();
      if (!this.onEditorCreated.observed && !this.onValidatorChanged) {
        return;
      }
      raf$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        if (this.onValidatorChanged) {
          this.onValidatorChanged();
        }
        this.onEditorCreated.emit(this.quillEditor);
      });
    });
  }
  ngOnChanges(changes) {
    if (!this.quillEditor) {
      return;
    }
    if (changes.readOnly) {
      this.quillEditor.enable(!changes.readOnly.currentValue);
    }
    if (changes.placeholder) {
      this.quillEditor.root.dataset.placeholder = changes.placeholder.currentValue;
    }
    if (changes.styles) {
      const currentStyling = changes.styles.currentValue;
      const previousStyling = changes.styles.previousValue;
      if (previousStyling) {
        Object.keys(previousStyling).forEach((key) => {
          this.renderer.removeStyle(this.editorElem, key);
        });
      }
      if (currentStyling) {
        Object.keys(currentStyling).forEach((key) => {
          this.renderer.setStyle(this.editorElem, key, this.styles()[key]);
        });
      }
    }
    if (changes.classes) {
      const currentClasses = changes.classes.currentValue;
      const previousClasses = changes.classes.previousValue;
      if (previousClasses) {
        this.removeClasses(previousClasses);
      }
      if (currentClasses) {
        this.addClasses(currentClasses);
      }
    }
    if (changes.debounceTime) {
      this.addQuillEventListeners();
    }
  }
  addClasses(classList) {
    _QuillEditorBase.normalizeClassNames(classList).forEach((c) => {
      this.renderer.addClass(this.editorElem, c);
    });
  }
  removeClasses(classList) {
    _QuillEditorBase.normalizeClassNames(classList).forEach((c) => {
      this.renderer.removeClass(this.editorElem, c);
    });
  }
  writeValue(currentValue) {
    if (this.filterNull() && currentValue === null) {
      return;
    }
    this.content = currentValue;
    if (!this.quillEditor) {
      return;
    }
    const format = getFormat(this.format(), this.service.config.format);
    const valueSetter = this.valueSetter();
    const newValue = valueSetter(this.quillEditor, currentValue);
    if (this.compareValues()) {
      const currentEditorValue = this.quillEditor.getContents();
      if (JSON.stringify(currentEditorValue) === JSON.stringify(newValue)) {
        return;
      }
    }
    if (currentValue) {
      if (format === "text") {
        this.quillEditor.setText(currentValue);
      } else {
        this.quillEditor.setContents(newValue);
      }
      return;
    }
    this.quillEditor.setText("");
  }
  setDisabledState(isDisabled = this.disabled) {
    this.disabled = isDisabled;
    if (this.quillEditor) {
      if (isDisabled) {
        this.quillEditor.disable();
        this.renderer.setAttribute(this.elementRef.nativeElement, "disabled", "disabled");
      } else {
        if (!this.readOnly()) {
          this.quillEditor.enable();
        }
        this.renderer.removeAttribute(this.elementRef.nativeElement, "disabled");
      }
    }
  }
  registerOnChange(fn) {
    this.onModelChange = fn;
  }
  registerOnTouched(fn) {
    this.onModelTouched = fn;
  }
  registerOnValidatorChange(fn) {
    this.onValidatorChanged = fn;
  }
  validate() {
    if (!this.quillEditor) {
      return null;
    }
    const err = {};
    let valid = true;
    const text = this.quillEditor.getText();
    const textLength = this.trimOnValidation() ? text.trim().length : text.length === 1 && text.trim().length === 0 ? 0 : text.length - 1;
    const deltaOperations = this.quillEditor.getContents().ops;
    const onlyEmptyOperation = !!deltaOperations && deltaOperations.length === 1 && ["\n", ""].includes(deltaOperations[0].insert?.toString());
    if (this.minLength() && textLength && textLength < this.minLength()) {
      err.minLengthError = {
        given: textLength,
        minLength: this.minLength()
      };
      valid = false;
    }
    if (this.maxLength() && textLength > this.maxLength()) {
      err.maxLengthError = {
        given: textLength,
        maxLength: this.maxLength()
      };
      valid = false;
    }
    if (this.required() && !textLength && onlyEmptyOperation) {
      err.requiredError = {
        empty: true
      };
      valid = false;
    }
    return valid ? null : err;
  }
  addQuillEventListeners() {
    this.dispose();
    this.zone.runOutsideAngular(() => {
      this.eventsSubscription = new Subscription();
      this.eventsSubscription.add(
        // mark model as touched if editor lost focus
        fromEvent(this.quillEditor, "selection-change").subscribe(([range, oldRange, source]) => {
          this.selectionChangeHandler(range, oldRange, source);
        })
      );
      let textChange$ = fromEvent(this.quillEditor, "text-change");
      let editorChange$ = fromEvent(this.quillEditor, "editor-change");
      if (typeof this.debounceTime() === "number") {
        textChange$ = textChange$.pipe(debounceTime(this.debounceTime()));
        editorChange$ = editorChange$.pipe(debounceTime(this.debounceTime()));
      }
      this.eventsSubscription.add(
        // update model if text changes
        textChange$.subscribe(([delta, oldDelta, source]) => {
          this.textChangeHandler(delta, oldDelta, source);
        })
      );
      this.eventsSubscription.add(
        // triggered if selection or text changed
        editorChange$.subscribe(([event, current, old, source]) => {
          this.editorChangeHandler(event, current, old, source);
        })
      );
    });
  }
  dispose() {
    this.eventsSubscription?.unsubscribe();
    this.eventsSubscription = null;
  }
  isEmptyValue(html) {
    return html === "<p></p>" || html === "<div></div>" || html === "<p><br></p>" || html === "<div><br></div>";
  }
  static {
    this.ɵfac = function QuillEditorBase_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _QuillEditorBase)();
    };
  }
  static {
    this.ɵdir = ɵɵdefineDirective({
      type: _QuillEditorBase,
      inputs: {
        format: [1, "format"],
        theme: [1, "theme"],
        modules: [1, "modules"],
        debug: [1, "debug"],
        readOnly: [1, "readOnly"],
        placeholder: [1, "placeholder"],
        maxLength: [1, "maxLength"],
        minLength: [1, "minLength"],
        required: [1, "required"],
        formats: [1, "formats"],
        customToolbarPosition: [1, "customToolbarPosition"],
        sanitize: [1, "sanitize"],
        beforeRender: [1, "beforeRender"],
        styles: [1, "styles"],
        registry: [1, "registry"],
        bounds: [1, "bounds"],
        customOptions: [1, "customOptions"],
        customModules: [1, "customModules"],
        trackChanges: [1, "trackChanges"],
        classes: [1, "classes"],
        trimOnValidation: [1, "trimOnValidation"],
        linkPlaceholder: [1, "linkPlaceholder"],
        compareValues: [1, "compareValues"],
        filterNull: [1, "filterNull"],
        debounceTime: [1, "debounceTime"],
        defaultEmptyValue: [1, "defaultEmptyValue"],
        valueGetter: [1, "valueGetter"],
        valueSetter: [1, "valueSetter"]
      },
      outputs: {
        onEditorCreated: "onEditorCreated",
        onEditorChanged: "onEditorChanged",
        onContentChanged: "onContentChanged",
        onSelectionChanged: "onSelectionChanged",
        onFocus: "onFocus",
        onBlur: "onBlur",
        onNativeFocus: "onNativeFocus",
        onNativeBlur: "onNativeBlur"
      },
      features: [ɵɵNgOnChangesFeature]
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(QuillEditorBase, [{
    type: Directive
  }], () => [], {
    onEditorCreated: [{
      type: Output
    }],
    onEditorChanged: [{
      type: Output
    }],
    onContentChanged: [{
      type: Output
    }],
    onSelectionChanged: [{
      type: Output
    }],
    onFocus: [{
      type: Output
    }],
    onBlur: [{
      type: Output
    }],
    onNativeFocus: [{
      type: Output
    }],
    onNativeBlur: [{
      type: Output
    }]
  });
})();
var QuillEditorComponent = class _QuillEditorComponent extends QuillEditorBase {
  static {
    this.ɵfac = /* @__PURE__ */ (() => {
      let ɵQuillEditorComponent_BaseFactory;
      return function QuillEditorComponent_Factory(__ngFactoryType__) {
        return (ɵQuillEditorComponent_BaseFactory || (ɵQuillEditorComponent_BaseFactory = ɵɵgetInheritedFactory(_QuillEditorComponent)))(__ngFactoryType__ || _QuillEditorComponent);
      };
    })();
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _QuillEditorComponent,
      selectors: [["quill-editor"]],
      features: [ɵɵProvidersFeature([{
        multi: true,
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => _QuillEditorComponent)
      }, {
        multi: true,
        provide: NG_VALIDATORS,
        useExisting: forwardRef(() => _QuillEditorComponent)
      }]), ɵɵInheritDefinitionFeature],
      ngContentSelectors: _c1,
      decls: 5,
      vars: 2,
      consts: [["quill-editor-element", ""]],
      template: function QuillEditorComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef(_c0);
          ɵɵtemplate(0, QuillEditorComponent_Conditional_0_Template, 1, 0, "div", 0);
          ɵɵprojection(1);
          ɵɵprojection(2, 1);
          ɵɵprojection(3, 2);
          ɵɵtemplate(4, QuillEditorComponent_Conditional_4_Template, 1, 0, "div", 0);
        }
        if (rf & 2) {
          ɵɵconditional(ctx.toolbarPosition() !== "top" ? 0 : -1);
          ɵɵadvance(4);
          ɵɵconditional(ctx.toolbarPosition() === "top" ? 4 : -1);
        }
      },
      styles: ["[_nghost-%COMP%]{display:inline-block}"]
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(QuillEditorComponent, [{
    type: Component,
    args: [{
      encapsulation: ViewEncapsulation.Emulated,
      providers: [{
        multi: true,
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => QuillEditorComponent)
      }, {
        multi: true,
        provide: NG_VALIDATORS,
        useExisting: forwardRef(() => QuillEditorComponent)
      }],
      selector: "quill-editor",
      template: `
    @if (toolbarPosition() !== 'top') {
        <div quill-editor-element></div>
    }

    <ng-content select="[above-quill-editor-toolbar]"></ng-content>
    <ng-content select="[quill-editor-toolbar]"></ng-content>
    <ng-content select="[below-quill-editor-toolbar]"></ng-content>

    @if (toolbarPosition() === 'top') {
        <div quill-editor-element></div>
    }
  `,
      styles: [":host{display:inline-block}\n"]
    }]
  }], null, null);
})();
var QuillViewHTMLComponent = class _QuillViewHTMLComponent {
  constructor() {
    this.content = input("");
    this.theme = input(void 0);
    this.sanitize = input(void 0);
    this.innerHTML = signal("");
    this.themeClass = signal("ql-snow");
    this.sanitizer = inject(DomSanitizer);
    this.service = inject(QuillService);
  }
  ngOnChanges(changes) {
    if (changes.theme) {
      const theme = changes.theme.currentValue || (this.service.config.theme ? this.service.config.theme : "snow");
      this.themeClass.set(`ql-${theme} ngx-quill-view-html`);
    } else if (!this.theme()) {
      const theme = this.service.config.theme ? this.service.config.theme : "snow";
      this.themeClass.set(`ql-${theme} ngx-quill-view-html`);
    }
    if (changes.content) {
      const content = changes.content.currentValue;
      const sanitize = [true, false].includes(this.sanitize()) ? this.sanitize() : this.service.config.sanitize || false;
      const innerHTML = sanitize ? content : this.sanitizer.bypassSecurityTrustHtml(content);
      this.innerHTML.set(innerHTML);
    }
  }
  static {
    this.ɵfac = function QuillViewHTMLComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _QuillViewHTMLComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _QuillViewHTMLComponent,
      selectors: [["quill-view-html"]],
      inputs: {
        content: [1, "content"],
        theme: [1, "theme"],
        sanitize: [1, "sanitize"]
      },
      features: [ɵɵNgOnChangesFeature],
      decls: 2,
      vars: 3,
      consts: [[1, "ql-container"], [1, "ql-editor", 3, "innerHTML"]],
      template: function QuillViewHTMLComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelementStart(0, "div", 0);
          ɵɵelement(1, "div", 1);
          ɵɵelementEnd();
        }
        if (rf & 2) {
          ɵɵclassMap(ctx.themeClass());
          ɵɵadvance();
          ɵɵproperty("innerHTML", ctx.innerHTML(), ɵɵsanitizeHtml);
        }
      },
      styles: [".ql-container.ngx-quill-view-html{border:0}\n"],
      encapsulation: 2
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(QuillViewHTMLComponent, [{
    type: Component,
    args: [{
      encapsulation: ViewEncapsulation.None,
      selector: "quill-view-html",
      template: `
  <div class="ql-container" [class]="themeClass()">
    <div class="ql-editor" [innerHTML]="innerHTML()">
    </div>
  </div>
`,
      styles: [".ql-container.ngx-quill-view-html{border:0}\n"]
    }]
  }], null, null);
})();
var QuillViewComponent = class _QuillViewComponent {
  constructor() {
    this.format = input(void 0);
    this.theme = input(void 0);
    this.modules = input(void 0);
    this.debug = input(false);
    this.formats = input(void 0);
    this.sanitize = input(void 0);
    this.beforeRender = input();
    this.strict = input(true);
    this.content = input();
    this.customModules = input([]);
    this.customOptions = input([]);
    this.onEditorCreated = new EventEmitter();
    this.elementRef = inject(ElementRef);
    this.renderer = inject(Renderer2);
    this.ngZone = inject(NgZone);
    this.service = inject(QuillService);
    this.sanitizer = inject(DomSanitizer);
    this.platformId = inject(PLATFORM_ID);
    this.destroyRef = inject(DestroyRef);
    this.valueSetter = (quillEditor, value) => {
      const format = getFormat(this.format(), this.service.config.format);
      let content = value;
      if (format === "text") {
        quillEditor.setText(content);
      } else {
        if (format === "html") {
          const sanitize = [true, false].includes(this.sanitize()) ? this.sanitize() : this.service.config.sanitize || false;
          if (sanitize) {
            value = this.sanitizer.sanitize(SecurityContext.HTML, value);
          }
          content = quillEditor.clipboard.convert({
            html: value
          });
        } else if (format === "json") {
          try {
            content = JSON.parse(value);
          } catch {
            content = [{
              insert: value
            }];
          }
        }
        quillEditor.setContents(content);
      }
    };
  }
  ngOnChanges(changes) {
    if (!this.quillEditor) {
      return;
    }
    if (changes.content) {
      this.valueSetter(this.quillEditor, changes.content.currentValue);
    }
  }
  ngAfterViewInit() {
    if (isPlatformServer(this.platformId)) {
      return;
    }
    const quillSubscription = this.service.getQuill().pipe(mergeMap((Quill) => this.service.beforeRender(Quill, this.customModules(), this.beforeRender()))).subscribe((Quill) => {
      const modules = Object.assign({}, this.modules() || this.service.config.modules);
      modules.toolbar = false;
      this.customOptions().forEach((customOption) => {
        const newCustomOption = Quill.import(customOption.import);
        newCustomOption.whitelist = customOption.whitelist;
        Quill.register(newCustomOption, true);
      });
      let debug = this.debug();
      if (!debug && debug !== false && this.service.config.debug) {
        debug = this.service.config.debug;
      }
      let formats = this.formats();
      if (formats === void 0) {
        formats = this.service.config.formats ? [...this.service.config.formats] : this.service.config.formats === null ? null : void 0;
      }
      const theme = this.theme() || (this.service.config.theme ? this.service.config.theme : "snow");
      this.editorElem = this.elementRef.nativeElement.querySelector("[quill-view-element]");
      this.ngZone.runOutsideAngular(() => {
        this.quillEditor = new Quill(this.editorElem, {
          debug,
          formats,
          modules,
          readOnly: true,
          strict: this.strict(),
          theme
        });
      });
      this.renderer.addClass(this.editorElem, "ngx-quill-view");
      if (this.content()) {
        this.valueSetter(this.quillEditor, this.content());
      }
      if (!this.onEditorCreated.observed) {
        return;
      }
      raf$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.onEditorCreated.emit(this.quillEditor);
      });
    });
    this.destroyRef.onDestroy(() => quillSubscription.unsubscribe());
  }
  static {
    this.ɵfac = function QuillViewComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _QuillViewComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _QuillViewComponent,
      selectors: [["quill-view"]],
      inputs: {
        format: [1, "format"],
        theme: [1, "theme"],
        modules: [1, "modules"],
        debug: [1, "debug"],
        formats: [1, "formats"],
        sanitize: [1, "sanitize"],
        beforeRender: [1, "beforeRender"],
        strict: [1, "strict"],
        content: [1, "content"],
        customModules: [1, "customModules"],
        customOptions: [1, "customOptions"]
      },
      outputs: {
        onEditorCreated: "onEditorCreated"
      },
      features: [ɵɵNgOnChangesFeature],
      decls: 1,
      vars: 0,
      consts: [["quill-view-element", ""]],
      template: function QuillViewComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelement(0, "div", 0);
        }
      },
      styles: [".ql-container.ngx-quill-view{border:0}\n"],
      encapsulation: 2
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(QuillViewComponent, [{
    type: Component,
    args: [{
      encapsulation: ViewEncapsulation.None,
      selector: "quill-view",
      template: `
  <div quill-view-element></div>
`,
      styles: [".ql-container.ngx-quill-view{border:0}\n"]
    }]
  }], null, {
    onEditorCreated: [{
      type: Output
    }]
  });
})();
var QuillModule = class _QuillModule {
  static forRoot(config) {
    return {
      ngModule: _QuillModule,
      providers: [{
        provide: QUILL_CONFIG_TOKEN,
        useValue: config
      }]
    };
  }
  static {
    this.ɵfac = function QuillModule_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _QuillModule)();
    };
  }
  static {
    this.ɵmod = ɵɵdefineNgModule({
      type: _QuillModule,
      imports: [QuillEditorComponent, QuillViewComponent, QuillViewHTMLComponent],
      exports: [QuillEditorComponent, QuillViewComponent, QuillViewHTMLComponent]
    });
  }
  static {
    this.ɵinj = ɵɵdefineInjector({});
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(QuillModule, [{
    type: NgModule,
    args: [{
      imports: [QuillEditorComponent, QuillViewComponent, QuillViewHTMLComponent],
      exports: [QuillEditorComponent, QuillViewComponent, QuillViewHTMLComponent]
    }]
  }], null, null);
})();
export {
  QUILL_CONFIG_TOKEN,
  QuillConfigModule,
  QuillEditorBase,
  QuillEditorComponent,
  QuillModule,
  QuillService,
  QuillViewComponent,
  QuillViewHTMLComponent,
  defaultModules,
  provideQuillConfig
};
//# sourceMappingURL=ngx-quill.js.map

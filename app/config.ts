export const settings: Map<string, Setting<any>> = new Map();

export class Setting<T> {
  constructor(
    public readonly name: string,
    /** The setting becomes visible on the settings page if this is non-null */
    public readonly desc: string | null,
    public readonly defaultVal: T,
    public readonly validator?: (v: T) => boolean
  ) {
    settings.set(name, this);
  }
  public get settingType(): string {
    return typeof this.defaultVal;
  }
  public get val(): T {
    let val: T;
    try {
      val = JSON.parse(window.localStorage[this.name]);
    } catch {
      console.warn(`failed parsing JSON reading ${this.name}`);
      return this.defaultVal;
    }
    switch (typeof this.defaultVal) {
      case "boolean":
        //@ts-ignore
        val = !!val;
        break;
    }
    if (!this.validator || this.validator(val)) {
      console.warn(`failed parsing JSON reading ${this.name}`);
      return val;
    } else {
      return this.defaultVal;
    }
  }
  public set val(val: T) {
    if (!this.validator || this.validator(val)) {
      window.localStorage[this.name] = JSON.stringify(val);
    } else {
      console.warn(`attempt to store invalid value in ${this.name}`, val);
    }
  }
}

export const showWelcome = new Setting(
  "showWelcome",
  "Show welcome page at startup",
  true
);

export const useFileNames = new Setting(
  "useFileNames",
  "Refer to sequences by their filenames where possible (rather than using the LOCUS)",
  true
);

export const leftPaneWidth = new Setting(
  "leftPaneWidth",
  null,
  324,
  v => v >= 324 && v < window.innerWidth
);
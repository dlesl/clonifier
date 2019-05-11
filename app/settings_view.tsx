import * as React from "react";
import { Tab } from "./tab";
import { Setting, settings } from "./config";
export default class SettingsTab extends Tab {
  constructor() {
    super();
  }
  get symbol() {
    return "🎛️";
  }
  public renderButton() {
    return "Settings";
  }
  public renderSelf() {
    return <SettingsView />;
  }
}

const SettingsView = () => {
  return (
    <div>
      {Array.from(settings)
        .filter(([_, val]) => val.desc !== null)
        .map(([_, val]) => {
          switch (val.settingType) {
            case "number":
              return <NumberSetting setting={val} />;
            case "string":
              return <StringSetting setting={val} />;
            case "boolean":
              return <BooleanSetting setting={val} />;
            default:
              return <p>Unsupported setting type: {val.settingType}</p>;
          }
        })}
    </div>
  );
};

interface Props<T> {
  setting: Setting<T>;
}

const NumberSetting = ({ setting }: Props<number>) => {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && (!setting.validator || setting.validator(val))) {
      setting.val = val;
      e.target.setCustomValidity("");
    } else {
      e.target.setCustomValidity("Invalid value");
    }
  };
  return (
    <p>
      <label>
        <input
          type="text"
          defaultValue={setting.val.toString()}
          onChange={onChange}
        />
        {setting.desc}{" "}
      </label>
    </p>
  );
};
const StringSetting = ({ setting }: Props<string>) => {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!setting.validator || setting.validator(e.target.value)) {
      setting.val = e.target.value;
      e.target.setCustomValidity("");
    } else {
      e.target.setCustomValidity("Invalid value");
    }
  };
  return (
    <p>
      <label>
        <input type="text" defaultValue={setting.val} onChange={onChange} />
        {setting.desc}{" "}
      </label>
    </p>
  );
};
const BooleanSetting = ({ setting }: Props<boolean>) => {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    if (!setting.validator || setting.validator(val)) {
      setting.val = val;
      e.target.setCustomValidity("");
    } else {
      e.target.setCustomValidity("Invalid value");
    }
  };
  return (
    <p>
      <label>
        <input
          type="checkbox"
          defaultChecked={setting.val}
          onChange={onChange}
        />
        {setting.desc}{" "}
      </label>
    </p>
  );
};

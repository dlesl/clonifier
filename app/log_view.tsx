import * as React from "react";
import { appContext } from ".";
import { Tab } from "./tab";

export default class LogTab extends Tab {
  constructor() {
    super();
  }
  get symbol() {
    return "📜";
  }
  public renderButton() {
    return <>Log</>;
  }
  public renderSelf() {
    return <LogView />;
  }
}

function LogView() {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  const last = React.useRef<HTMLParagraphElement>(null);
  React.useEffect(() => {
    let cb = () => forceUpdate({});
    appContext.addLogListener(cb);
    return () => appContext.removeLogListener(cb);
  }, []);
  React.useEffect(() => {
    if (last.current) last.current.scrollIntoView();
  });
  return (
    <div className="log">
      {appContext.logMessages.map(msg => (
        <p ref={last}>
          {msg.level} - {msg.msg}
        </p>
      ))}
    </div>
  );
}

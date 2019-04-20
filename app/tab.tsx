import * as React from "react";
import { appContext } from ".";
import { Seq } from "./worker_comms/worker_shims";

export abstract class Tab {
  private static key = 0;
  public readonly key: number;
  constructor() {
    this.key = Tab.key++;
  }
  public abstract renderSelf(): any;
  public abstract renderButton(): any;
  abstract get symbol(): string;
  /// override this to free resources, after this is called the tab will never be rendered again
  public free() {}
  public update(newTab: Tab): void {
    appContext.updateTab(this, newTab);
  }
  get seq(): Promise<Seq> | null {
    return null;
  }
  /// override this if the tab should be addressable by URL, i.e. if the content can be reproducibly
  /// represented by a short string, e.g. info pages, templates that can be fetched etc.
  get hash(): string | null {
    return null;
  }
}

export interface TabButtonProps {
  tab: Tab;
  selected: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export class TabButton extends React.PureComponent<TabButtonProps> {
  public static getDerivedStateFromError(error) {
    return { error: true };
  }
  public state: { error: boolean };
  constructor(props) {
    super(props);
    this.state = { error: false };
  }
  public render() {
    const { tab, selected, onSelect, onClose } = this.props;
    return (
      <div
        key={tab.key}
        className={"btn" + (selected ? " selected" : "")}
        onMouseDown={onSelect}
      >
        {!this.state.error && (
          <label>
            {tab.symbol} {tab.renderButton()}
          </label>
        )}
        {this.state.error && <label>Error!</label>}
        <a onClick={onClose} onMouseDown={e => e.stopPropagation()}>
          {"×"}
        </a>
      </div>
    );
  }
}

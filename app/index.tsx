import * as React from "react";
import * as ReactDOM from "react-dom";
import { Db, Fragment, Primer } from "./db";
import InfoTab from "./info_view";
import { LeftPanel, Panel } from "./left_panel";
import { ListData } from "./components/list_view";
import { Menu, MenuBar, MenuButton } from "./menu";
import { Tab, TabButton } from "./tab";
import SeqTab from "./seq_view";
import * as utils from "./utils";
import { parse_bin, parse_gb, Seq } from "./worker_comms/worker_shims";
import { standardTemplates } from "../templates";
import { LogMessage } from "../worker/shared";
import LogTab from "./log_view";
import { ErrorBoundary } from "./components/error_boundary";
import {
  dbgPendingCalls,
  dbgLogObjects,
  setErrorHandler,
  setLogHandler
} from "./worker_comms";
import { showWelcome, useFileNames } from "./config";
import { readFileBinary, fetchBinary, removeGbExt } from "./utils/io";
import SettingsTab from "./settings_view";

const StandardTemplates = React.memo(() => {
  return (
    <>
      {standardTemplates.map((t, idx) => (
        <MenuButton
          key={idx}
          onClick={() => {
            const filename = `${t.basename}.bin`;
            const seq = fetchBinary(filename).then(parse_bin);
            appContext.addTab(new SeqTab(seq, t.name, "bin:" + filename));
          }}
        >
          {t.name}
        </MenuButton>
      ))}
    </>
  );
});

interface State {
  status: string;
  tabs: Tab[];
  selectedTab: Tab | null;
  selectedPanel: Panel;
  fragments: ListData<Fragment>;
  primers: ListData<Primer>;
}

export interface AppContext {
  updateTab: (oldTab: Tab, newTab: Tab) => void;
  openUrl: (url: string) => void;
  addTab: (newTab: Tab) => void;
  saveFragment: (s: Seq) => Promise<void>;
  loadFiles: (f: FileList) => void;
  saveFiles: (f: FileList) => void;
  logMessage: (msg: LogMessage) => void;
  addLogListener: (cb: (msg: LogMessage) => void) => void;
  removeLogListener: (cb: (msg: LogMessage) => void) => void;
  addPrimer: (p: Primer) => void;
  logMessages: LogMessage[];
  db: Db;
}

export let appContext: AppContext = null;

class App extends React.PureComponent<{}, State> {
  public fileOpenRef: React.RefObject<HTMLInputElement>;
  public fileImportRef: React.RefObject<HTMLInputElement>;

  constructor(props) {
    super(props);
    this.fileOpenRef = React.createRef();
    this.fileImportRef = React.createRef();
    const logMessages = [];
    const logMessageListeners = new Set<Function>();
    appContext = {
      updateTab: this.updateTab,
      addTab: this.addTab,
      saveFragment: this.saveFragment,
      loadFiles: this.loadFiles,
      saveFiles: this.saveFiles,
      logMessage: (msg: LogMessage) => {
        logMessages.push(msg);
        for (const l of logMessageListeners) {
          l(msg);
        }
      },
      addLogListener: cb => {
        logMessageListeners.add(cb);
      },
      removeLogListener: cb => {
        logMessageListeners.delete(cb);
      },
      addPrimer: (p: Primer) => {
        this.setState(s => ({ primers: s.primers.append(p) }));
      },
      openUrl: this.openUrl,
      logMessages,
      db: new Db()
    };
    // set up worker logging
    setLogHandler(appContext.logMessage);
    const welcome = showWelcome.val
      ? new InfoTab("Welcome", "welcome.html")
      : null;
    const tabs = welcome ? [welcome] : [];
    const selectedTab = welcome;
    this.state = {
      status: "Ready",
      tabs,
      selectedTab,
      selectedPanel: Panel.Primers,
      fragments: new ListData([]),
      primers: new ListData([])
    };
  }
  public componentDidCatch(error: any, info: any) {
    alert("Something went wrong: " + error + info);
  }
  public fail(error: string) {
    alert(error);
  }
  public saveFiles = (files: FileList) => {
    this.setState({ selectedPanel: Panel.Fragments });
    for (const f of files) {
      const name = f.name;
      (async () => {
        try {
          const data = await readFileBinary(f);
          const seqs = await parse_gb(data);
          if (seqs.length === 1 && useFileNames.val) {
            const seq = await seqs[0].set_name(removeGbExt(f.name));
            await this.saveFragment(seq);
          } else {
            seqs.forEach(seq => this.saveFragment(seq));
          }
        } catch (e) {
          alert(`Importing '${name}' failed: ${e.toString()}`);
        }
      })();
    }
  };
  public loadFiles = async (files: FileList) => {
    // Open one tab per file. If a file contains no sequences, that tab will fail
    // with an error. If it contains more than one, more tabs will be opened.
    try {
      for (const f of files) {
        const ab = await readFileBinary(f);
        const seqs: Seq[] = await parse_gb(ab);
        if (seqs.length === 0) {
          throw new Error(`File: '${f.name}' contains no sequences`);
        }
        if (seqs.length === 1 && useFileNames.val) {
          const seq = seqs[0].set_name(removeGbExt(f.name));
          // @ts-ignore
          ReactDOM.flushSync(() => this.addTab(new SeqTab(seq, f.name)));
        } else {
          for (const seq of seqs) {
            this.addTab(new SeqTab(Promise.resolve(seq), f.name));
          }
        }
      }
    } catch (error) {
      this.fail(error);
    }
  };
  public saveFragment = async (s: Seq) => {
    this.setState({ selectedPanel: Panel.Fragments }); // visual feedback
    const [metadata, data] = await Promise.all([s.get_metadata(), s.to_bin()]);
    const blob = new Blob([data], { type: "" });
    const f: Fragment = {
      blob,
      name: metadata.name,
      len: metadata.len,
      circular: metadata.circular
    };
    await appContext.db.fragments.add(f).then(id => {
      f.id = id;
      this.setState(state => {
        return {
          fragments: state.fragments.append(f)
        };
      });
    });
  };
  public addTab = (tab: Tab) => {
    this.setState(state => {
      return {
        tabs: state.tabs.concat(tab),
        selectedTab: tab
      };
    });
  };
  public closeTab = (tab: Tab) => {
    const keptTabs = this.state.tabs.filter(t => t !== tab);
    this.setState(
      {
        tabs: keptTabs,
        selectedTab: keptTabs.length > 0 ? keptTabs[keptTabs.length - 1] : null
      },
      () => tab.free()
    );
  };
  public closeAllTabs() {
    const oldTabs = this.state.tabs;
    this.setState(
      {
        tabs: [],
        selectedTab: null
      },
      () => oldTabs.forEach(tab => tab.free())
    );
  }
  public updateTab = (oldTab: Tab, newTab: Tab) => {
    const newTabs = this.state.tabs.slice();
    const idx = newTabs.findIndex(t => t === oldTab);
    if (idx !== -1) {
      newTabs[idx] = newTab;
      this.setState(
        state => {
          return {
            tabs: newTabs,
            selectedTab:
              state.selectedTab === oldTab ? newTab : state.selectedTab
          };
        },
        () => oldTab.free()
      );
    }
  };
  public openUrl = (url: string) => {
    // first check if this url is already open, and if so switch to that tab
    for (const t of this.state.tabs) {
      if (t.hash === url) {
        this.setState({ selectedTab: t });
        return;
      }
    }
    const { scheme, rest } = utils.splitUrl(url);
    switch (scheme) {
      case "info":
        this.addTab(new InfoTab(rest, rest)); // TODO: set name
        break;
      case "bin":
        this.addTab(new SeqTab(fetchBinary(rest).then(parse_bin), rest, url));
        break;
    }
  };
  public updateFragments = fragments => {
    this.setState({ fragments });
  };
  public updatePrimers = primers => {
    this.setState({ primers });
  };
  public setSelectedPanel = selectedPanel => {
    this.setState({ selectedPanel });
  };
  public render() {
    const tabButtons = this.state.tabs.map(t => (
      <TabButton
        key={t.key}
        tab={t}
        selected={this.state.selectedTab === t}
        onSelect={() => this.setState({ selectedTab: t })}
        onClose={() => this.closeTab(t)}
      />
    ));
    const tabs = this.state.tabs.map(t => (
      <div
        key={t.key}
        className="content middle center scroll"
        style={t === this.state.selectedTab ? {} : { display: "none" }}
      >
        <React.Suspense fallback={<p>Loading...</p>}>
          <ErrorBoundary>{t.renderSelf()}</ErrorBoundary>
        </React.Suspense>
      </div>
    ));
    return (
      <div
        id="main"
        onDrop={e => {
          e.preventDefault();
          if (e.dataTransfer.files) {
            this.loadFiles(e.dataTransfer.files);
          }
        }}
        onDragOver={e => e.preventDefault()}
      >
        <MenuBar>
          <Menu name="File">
            <MenuButton onClick={() => this.fileOpenRef.current.click()}>
              Open...
            </MenuButton>
            <MenuButton onClick={() => this.fileImportRef.current.click()}>
              Import...
            </MenuButton>
          </Menu>
          <Menu name="Standard Templates">
            <StandardTemplates />
          </Menu>
          <Menu name="Tabs">
            <MenuButton onClick={() => this.closeAllTabs()}>
              Close all
            </MenuButton>
          </Menu>
          <Menu name="Tools">
            <MenuButton
              onClick={() => {
                for (const t of this.state.tabs) {
                  if (t instanceof SettingsTab) {
                    this.setState({ selectedTab: t });
                    return;
                  }
                }
                this.addTab(new SettingsTab());
              }}
            >
              Settings
            </MenuButton>
          </Menu>
          <Menu name="Help">
            <MenuButton
              onClick={() => this.addTab(new InfoTab("Guide", "guide.html"))}
            >
              Guide
            </MenuButton>
            <MenuButton
              onClick={() =>
                this.addTab(new InfoTab("Tutorial", "tutorial.html"))
              }
            >
              Tutorial
            </MenuButton>
            <MenuButton
              onClick={() =>
                this.addTab(new InfoTab("Welcome", "welcome.html"))
              }
            >
              Welcome page
            </MenuButton>
            <MenuButton
              onClick={() => this.addTab(new InfoTab("About", "about.html"))}
            >
              About
            </MenuButton>
            <hr />
            <MenuButton
              onClick={() =>
                window.open("https://github.com/dlesl/clonifier", "_blank")
              }
            >
              Github Repo
            </MenuButton>
            <MenuButton
              onClick={() => {
                this.addTab(new LogTab());
              }}
            >
              Debug log
            </MenuButton>
            {utils.isDevMode() && (
              <>
                <hr />
                <MenuButton onClick={() => console.log(dbgPendingCalls())}>
                  Pending calls
                </MenuButton>
                <MenuButton onClick={() => dbgLogObjects()}>
                  Remote objects
                </MenuButton>
              </>
            )}
          </Menu>
        </MenuBar>
        <LeftPanel
          selectedPanel={this.state.selectedPanel}
          setSelectedPanel={this.setSelectedPanel}
          fragments={this.state.fragments}
          setFragments={this.updateFragments}
          primers={this.state.primers}
          setPrimers={this.updatePrimers}
          templateSelected={
            this.state.selectedTab ? this.state.selectedTab.seq : null
          }
        />
        <div className="toolbar scroll">
          {tabButtons}
          <span className="spacer" />
          <input
            type="file"
            id="file_open"
            onChange={e => {
              if (e.target.files) {
                this.loadFiles(e.target.files);
              }
              e.target.value = "";
            }}
            multiple={true}
            ref={this.fileOpenRef}
          />
          <input
            type="file"
            id="file_import"
            onChange={e => {
              if (e.target.files) {
                this.saveFiles(e.target.files);
              }
              e.target.value = "";
            }}
            multiple={true}
            ref={this.fileImportRef}
          />
        </div>
        {tabs}
        <div id="status" className="panel statusbar center recessed_light">
          {this.state.status}
        </div>
        <div className="panel recessed_light statusbar tasks" />
      </div>
    );
  }
  public componentDidUpdate(prevProps, prevState: State) {
    if (prevState.selectedTab !== this.state.selectedTab) {
      const hash = this.state.selectedTab ? this.state.selectedTab.hash : null;
      window.location.replace("#!" + (hash || ""));
    }
  }
  public componentDidMount() {
    appContext.db.fragments.toArray(fragments =>
      this.setState({ fragments: new ListData(fragments) })
    );
    const hash = window.location.hash;
    if (hash) {
      // remove "#!";
      this.openUrl(hash.substring(2));
    }
  }
}

// unrecoverable error handler
export function bsod(e: string) {
  document.getElementById("app").setAttribute("style", "display: none");
  document.getElementById("bsod").removeAttribute("style");
  document.getElementById("bsod_message").innerText = e;
}

// set worker error handler
setErrorHandler(bsod);

// signal to the error handler in index.html that we made it this far
window["_appLoadSuccess"] = true;
// remove loading screen
document.getElementById("loading").remove();
// @ts-ignore
ReactDOM.unstable_createRoot(document.getElementById("app")).render(<App />);

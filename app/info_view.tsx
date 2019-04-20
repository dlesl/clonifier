import * as React from "react";
import { appContext } from ".";
import { readCachedPromise } from "./utils/suspense";
import { Tab } from "./tab";
import { fetchText, fetchBinary, splitUrl } from "./utils";
import { parse_bin } from "./worker_comms/worker_shims";
import SeqTab from "./seq_view";
import { settings } from "./config";
import { url } from "inspector";

export default class InfoTab extends Tab {
  private name: string;
  private url: string
  private htmlPromise: Promise<string>;
  constructor(name: string, url: string) {
    super();
    this.name = name;
    this.url = url;
    this.htmlPromise = fetchText(url);
  }
  get symbol() {
    return "📄";
  }
  public renderButton() {
    return <>{this.name}</>;
  }
  public renderSelf() {
    return <InfoView htmlPromise={this.htmlPromise} />;
  }
  get hash(): string | null {
    return "info:" + this.url;
  }
}

function InfoView({
  htmlPromise
}: {
  htmlPromise: Promise<string>;
}) {
  const html = readCachedPromise(htmlPromise);
  const divRef = React.useRef<HTMLDivElement>(null);
  const onLinkClicked = (href: string, title: string): (() => void) => {
    const { scheme, rest } = splitUrl(href);
    switch (scheme) {
      case "info":
        return () => appContext.addTab(new InfoTab(title, rest));
      case "http":
      case "https":
        return () => window.open(href, "_blank");
      case "bin+prefetch":
        const data = fetchBinary(rest);
        return () => {
          const seq = data.then(d => {
            // check if already 'used', i.e. transferred
            if (d.byteLength > 0) {
              return parse_bin(d);
            } else {
              return fetchBinary(rest).then(parse_bin);
            }
          });
          appContext.addTab(new SeqTab(seq, title, "bin:" + rest));
        };
      case "addprimers":
        return () => {
          for (const p of rest.split("$")) {
            const [name, seq, desc] = p.split("|");
            appContext.addPrimer({ name, seq, desc });
          }
        };
      default:
       appContext.openUrl(href);
    }
  };
  React.useEffect(() => {
    const div = divRef.current;
    div.innerHTML = html;
    // convert links
    const links = div.querySelectorAll("a");
    for (const l of links) {
      const href = l.getAttribute("href");
      if (href != null && href != "") {
        const title = l.getAttribute("title");
        const action = onLinkClicked(href, title ? title.toString() : "");
        l.addEventListener("click", e => {
          e.preventDefault();
          action();
        });
      }
    }
    const inputs = div.querySelectorAll("input");
    for (const i of inputs) {
      if (i.type === "checkbox") {
        const name = i.getAttribute("data-setting");
        const setting = settings.get(name);
        i.checked = setting.val;
        i.onchange = () => {
          setting.val = i.checked;
        };
      }
    }
    return () => (div.innerHTML = ""); // probably not necessary?
  }, []);
  return <div className="info" ref={divRef} />;
}

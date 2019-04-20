import { saveAs } from "file-saver";
import { MutableRefObject, useEffect, useState, useRef } from "react";
import ResizeObserver from "resize-observer-polyfill";
import { ValidationResult } from "../edit_field";
import useDebouncedCallback from "use-debounce/lib/callback";

// modulus
export function mod(n, m) {
  return ((n % m) + m) % m;
}

export class ResizeHandler {
  public panel: Element;
  public lpr: Element;
  public callback: (newWidth: number) => void;
  public minSize: number;
  public dragging: boolean;
  public startPos: number;
  public startSize: number;
  public timeout: number;

  constructor(public horizontal: boolean) {
    this.panel = null;
    this.lpr = null;
    this.callback = null;
  }
  public install(panel: Element, callback: (newWidth: number) => void) {
    // check if we need to reinstall
    // var panel = document.querySelector(".left_panel");
    if (panel === this.panel) {
      return;
    }

    this.uninstall();

    this.panel = panel;
    this.lpr = panel.querySelector(".resizer");
    this.minSize = parseFloat(
      window
        .getComputedStyle(panel)
        .getPropertyValue(this.horizontal ? "min-height" : "min-width")
    );
    if (isNaN(this.minSize)) {
      this.minSize = 0;
    }

    this.callback = callback;
    this.dragging = false;
    this.startPos = 0;
    this.startSize = 0;
    this.timeout = null;
    this.lpr.addEventListener("mousedown", this);
  }
  public uninstall() {
    if (this.timeout != null) {
      window.clearTimeout(this.timeout);
    }

    document.removeEventListener("mousemove", this);
    document.removeEventListener("mouseup", this);
  }
  public handleEvent(e) {
    this[e.type](e);
  }
  public mousemove(e) {
    if (this.dragging) {
      e.preventDefault();
      const distance =
        (this.horizontal ? e.screenY : e.screenX) - this.startPos;
      const newSize = this.startSize + distance;
      if (newSize >= this.minSize) {
        this.panel.setAttribute(
          "style",
          (this.horizontal ? "height: " : "width: ") + newSize + "px"
        );
        // don't re-render too often, it's expensive
        if (this.timeout !== null) {
          window.clearTimeout(this.timeout);
        }
        this.callback(newSize); // stress test
        this.timeout = window.setTimeout(() => {
          if (this.callback != null) {
            //    this.callback(newWidth);
          }
          this.timeout = null;
        }, 50);
      }
    }
  }
  public mouseup(e) {
    this.lpr.classList.remove("dragging");
    this.dragging = false;
    document.removeEventListener("mousemove", this);
    document.removeEventListener("mouseup", this);
  }
  public mousedown(e) {
    e.preventDefault();
    if (e.button == 0 && !this.dragging) {
      this.dragging = true;
      this.lpr.classList.add("dragging");
      this.startPos = this.horizontal ? e.screenY : e.screenX;
      this.startSize = this.horizontal
        ? this.panel.clientHeight
        : this.panel.clientWidth;
      document.addEventListener("mousemove", this);
      document.addEventListener("mouseup", this);
    }
  }
}

export const { getMonoCharDimensions } = new class {
  public width: number | null = null;
  public height: number | null = null;
  public getMonoCharDimensions: () => [number, number] = () => {
    if (!this.width) {
      const d = document.createElement("div");
      d.setAttribute("style", "display: inline-block; opacity: 0");
      d.classList.add("mono");
      d.innerText = "abcdefghij";
      document.body.appendChild(d);
      this.width = d.clientWidth / 10;
      this.height = d.clientHeight;
      d.remove();
    }
    return [this.width, this.height];
  };
}();

export function readFileBinary(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = e => resolve(fr.result as ArrayBuffer);
    fr.onerror = e => reject(new Error("Reading file failed: " + fr.result));
    fr.readAsArrayBuffer(file);
  });
}

// from here, mostly: https://github.com/bvaughn/react-window/issues/5
export function useElementSize(elementRef: MutableRefObject<HTMLElement>) {
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = elementRef.current;
    if (!node) {
      return;
    }
    // const style = window.getComputedStyle(node);
    // setSize({width: parseFloat(style.width), height: parseFloat(style.height)});
    const ro = new ResizeObserver(([{ contentRect }]) => {
      if (contentRect.width && contentRect.height) {
        // don't update if we're 0x0, i.e. invisible
        setSize({ width: contentRect.width, height: contentRect.height });
      }
    });
    ro.observe(node);
    return () => ro.unobserve(node);
  }, [elementRef.current]);

  return [width, height];
}

// https://stackoverflow.com/a/52369951

const numCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base"
});

export const numericCompare = numCollator.compare;

export function fastCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function readAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = e => resolve(fr.result as ArrayBuffer);
    fr.onerror = e => reject(new Error(`Error reading file: ${e}`));
    fr.readAsArrayBuffer(file);
  });
}

export function noWhiteSpace(val: string): ValidationResult {
  if (/\s/.test(val)) {
    return "No whitespace allowed";
  }
  return undefined;
}

function promiseFetch(url: string): Promise<Response> {
  return fetch(url).then(response => {
    if (response.ok) {
      return response;
    } else {
      throw new Error("Invalid response: " + response.statusText);
    }
  });
}

export function fetchText(url: string): Promise<string> {
  return promiseFetch(url).then(r => r.text());
}

export function fetchBinary(url: string): Promise<ArrayBuffer> {
  return promiseFetch(url).then(r => r.arrayBuffer());
}

export function downloadData(
  data: ArrayBuffer,
  fileName: string,
  mimeType: string
) {
  const blob = new Blob([data], { type: mimeType });
  saveAs(blob, fileName);
}

export function useDebouncedQueuedSearch<Q, R>(
  search: (query: Q) => Promise<R>
): [R | null, (query: Q) => void] {
  interface ISearch {
    ab: AbortController;
    promise: Promise<void>;
  }
  const searching = useRef<ISearch>(null);
  const [result, setResult] = useState<R | null>(null);
  const queueSearch = useDebouncedCallback(
    (query: Q) => {
      const promise = searching.current
        ? searching.current.promise
        : Promise.resolve();
      if (searching.current) {
        searching.current.ab.abort();
      }
      const ab = new AbortController();
      const signal = ab.signal;
      const doSearch = () => {
        if (signal.aborted) {
          return;
        }
        search(query).then(res => {
          if (!signal.aborted) {
            setResult(res);
          }
        });
      };
      searching.current = { ab, promise: promise.then(() => doSearch()) };
    },
    100,
    [searching.current]
  );
  return [result, queueSearch];
}

// from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isDevMode(): boolean {
  return process.env.NODE_ENV === "development";
}

export function splitUrl(url: string): { scheme: string; rest: string } {
  const colon = url.indexOf(":");
  const scheme = url.slice(0, colon);
  const rest = url.slice(colon + 1);
  return { scheme, rest };
}

import { saveAs } from "file-saver";

export function readFileBinary(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = e => resolve(fr.result as ArrayBuffer);
    fr.onerror = e => reject(new Error(`Error reading file: ${e}`));
    fr.readAsArrayBuffer(file);
  });
}

export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = e => resolve(fr.result as string);
    fr.onerror = e => reject(new Error(`Error reading file: ${e}`));
    fr.readAsText(file);
  });
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

export function removeGbExt(
  fname:string
): string {
  return fname.replace(/\.(gbk?|ape)$/i,"");
}
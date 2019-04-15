import { registerDialog } from "dialog-polyfill";
export function makeDialog(template: Element): HTMLDialogElement {
  const dialog = template.cloneNode(true) as HTMLDialogElement;
  dialog.removeAttribute("id");
  document.body.appendChild(dialog);
  registerDialog(dialog);
  return dialog;
}

export function promptDialog(
  text: string,
  def: string
): Promise<string | null> {
  const template = document.querySelector("#prompt_template");
  const dialog = makeDialog(template);
  dialog.querySelector("p").innerText = text;
  dialog.querySelector("input").value = def;
  const res = new Promise(resolve => {
    dialog.addEventListener("close", e => {
      if (dialog.returnValue === "ok") {
        resolve(dialog.querySelector("input").value);
      } else {
        resolve(null);
      }
    });
  }).finally(() => {
    dialog.remove();
  }) as Promise<string | null>;
  dialog.showModal();
  return res;
}

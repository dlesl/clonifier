import * as React from "react";

// This isn't (yet) a proper React component, it is ported from an earlier
// non-React version of the app...

function showMenu(node) {
  const el = document.querySelector(".menu_visible");
  if (el) {
    el.classList.remove("menu_visible");
  }
  node.classList.add("menu_visible");
}

function hideMenu() {
  const el = document.querySelector(".menu_visible");
  if (el) {
    el.classList.remove("menu_visible");
  }
}

export function setupMenu() {
  const menu_bar = document.querySelector(".menu_bar");
  menu_bar.addEventListener("mousedown", e => {
    const target = e.target as Element;
    if (target.classList.contains("drop_text")) {
      const parent = (target.parentNode as Element).closest(".menu_visible");
      if (parent != null) {
        parent.classList.remove("menu_visible");
      } else {
        showMenu(target.parentNode);
      }
    }
  });
  menu_bar.addEventListener("mouseover", e => {
    const target = e.target as Element;
    if (
      e.target !== e.currentTarget &&
      document.querySelector(".menu_visible") != null &&
      target.classList.contains("drop_text") &&
      !(target.parentNode as Element).classList.contains("menu_visible")
    ) {
      showMenu(target.parentNode);
    }
  });
  document.addEventListener("mousedown", e => {
    const target = e.target as Element;
    const menu = target.closest(".menu_visible");
    const clicked_self = target.closest(".menu_visible, .drop_text") != null;
    if (menu == null && !clicked_self) {
      const el = document.querySelector(".menu_visible");
      if (el) {
        el.classList.remove("menu_visible");
      }
    }
  });
}

export function MenuBar(props) {
  return <div className="menu_bar">{props.children}</div>;
}

export function Menu(props) {
  React.useEffect(() => setupMenu(), []);
  return (
    <div className="drop_container">
      <span className="drop_text">{props.name}</span>
      <div className="drop_items">{props.children}</div>
    </div>
  );
}

export function MenuButton(props) {
  return (
    <button
      onMouseUp={() => {
        hideMenu();
        props.onClick();
      }}
    >
      {props.children}
    </button>
  );
}

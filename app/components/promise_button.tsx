import * as React from "react";
import * as ReactDOM from "react-dom";

export interface IProps {
  onClick: () => Promise<any>;
  className?: string;
  buttonProps?: any;
  children: any;
  disabled?: boolean;
}

// A button that stays "pressed" until a promise resolves
export default function PromiseButton({
  onClick,
  className,
  buttonProps,
  children,
  disabled
}: IProps) {
  const [pressed, setPressed] = React.useState(false);
  if (className === undefined) {
    className = "button";
  }
  if (pressed) {
    className += " pressed";
  }
  const clickHandler = () => {
    if (pressed) {
      return;
    }
    const promise = onClick();
    if (promise) {
      // @ts-ignore
      ReactDOM.flushSync(() => setPressed(true));
      promise.finally(() => setPressed(false));
    }
  };
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={() => clickHandler()}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

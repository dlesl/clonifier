import * as React from "react";

export const useIntFromInputLS = (
  def: number,
  min: number,
  max: number,
  key: string
): [number | null, (e: React.ChangeEvent<HTMLInputElement>) => void] => {
  const [val, _setVal] = React.useState(() => {
    let initial = window.localStorage[key];
    if (initial) {
      initial = parseInt(initial, 10);
      if (!isNaN(initial) && initial >= min && initial <= max) {
        return initial;
      }
    }
    return def;
  });
  const setVal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= min && val <= max) {
      window.localStorage[key] = val;
      _setVal(val);
    } else {
      _setVal(null);
    }
  };
  return [val, setVal];
};

export const useScrollToRef = (
  ref: React.MutableRefObject<HTMLElement>,
  deps: any[]
) => {
  React.useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView(true);
    }
  }, deps);
};

export const ForkMe = () => {
  return (
    <a className="fork_me" href="https://github.com/dlesl/clonifier/">
      <img
        width="149"
        height="149"
        src="https://github.blog/wp-content/uploads/2008/12/forkme_right_darkblue_121621.png?resize=149%2C149"
        alt="Fork me on GitHub"
      />
    </a>
  );
};

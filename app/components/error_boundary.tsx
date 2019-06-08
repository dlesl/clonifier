import * as React from "react";

export class ErrorBoundary extends React.PureComponent {
  public static getDerivedStateFromError(error) {
    return { error };
  }
  public state: { error: any };
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  public componentDidCatch(error, info) {}
  public render() {
    if (this.state.error) {
      return <p>{`${this.state.error}`}</p>;
    }
    return this.props.children;
  }
}

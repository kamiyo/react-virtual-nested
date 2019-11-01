import * as React from "react";

type childrenFunction = (
  props: {
    width?: number;
    height?: number;
  }
) => React.ReactNode;

const updateDimensions = (
  element: HTMLDivElement,
  setHeight: (height: number) => void,
  setWidth: (width: number) => void
) => {
  if (element !== null) {
    const bounding = element.getBoundingClientRect();
    setHeight(bounding.height);
    setWidth(bounding.width);
  }
};

const Container: React.FC<{
  className?: string;
  children: childrenFunction;
}> = props => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number>(null);
  const [width, setWidth] = React.useState<number>(null);

  React.useEffect(() => {
    const handler = () => {
      if (ref.current) {
        updateDimensions(ref.current, setHeight, setWidth);
      }
    };

    handler();

    window.addEventListener("resize", handler);

    return () => window.removeEventListener("resize", handler);
  }, []);

  const measureRef = React.useCallback(el => {
    if (el !== null) {
      ref.current = el;
      updateDimensions(ref.current, setHeight, setWidth);
    }
  }, []);

  return (
    <div style={{ height: "100%", width: "100%" }} ref={measureRef}>
      {height && props.children({ height, width })}
    </div>
  );
};

export default Container;

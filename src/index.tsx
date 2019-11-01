import * as React from "react";
import { render } from "react-dom";

import Autosizer from "react-virtualized-auto-sizer";
import {
  BaseVirtualList,
  VirtualList,
  RowCache,
  RowRendererProps
} from "./VirtualList";

import "./styles.css";

const data = [];
const caches: RowCache[] = [];
for (let i = 0; i < 35; ++i) {
  caches[i] = new RowCache({
    length: (i % 10) + 2 * i + 5
    // estimatedRowHeight: 25
  });
  data[i] = {
    items: Array.from({ length: (i % 10) + 2 * i + 5 }).map(
      (v, ii) => `child ${ii}`
    )
  };
}

class nestedRenderer extends React.PureComponent<
  RowRendererProps<number, HTMLDivElement>
> {
  render() {
    const { data, index, style, parentOffset, innerRef } = this.props;
    return (
      <div className="nested-data" style={style} key={index} ref={innerRef}>
        {data}
      </div>
    );
  }
}

class RowRenderer extends React.PureComponent<
  RowRendererProps<{ items: number[] }, HTMLDivElement>
> {
  render() {
    const {
      index,
      style,
      innerRef,
      data,
      scrollTop,
      parentOffset,
      height
    } = this.props;
    return (
      <div className="row-data" key={index} style={style} ref={innerRef}>
        <div
          style={{
            backgroundColor: index % 2 ? "#A0A0A0" : "#BBBBBB",
            margin: 0,
            textAlign: "center",
            padding: 2
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              color: "black",
              backgroundColor: "white",
              height: "2rem",
              width: "2rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {index}
          </div>
          <BaseVirtualList
            data={data.items}
            rowCache={caches[index]}
            rowRenderer={nestedRenderer}
            scrollTop={scrollTop}
            parentOffset={parentOffset}
            height={height}
          />
        </div>
      </div>
    );
  }
}

const loadMore = async () => {};

const App: React.FC<{}> = props => {
  return (
    <div className="outside">
      <button>Load More</button>
      <div className="list-container">
        <Autosizer disableWidth={true}>
          {({ height }) => {
            return (
              <VirtualList
                height={height}
                data={data}
                estimatedRowHeight={60}
                rowRenderer={RowRenderer}
              />
            );
          }}
        </Autosizer>
      </div>
    </div>
  );
};

const rootElement = document.getElementById("root");
render(<App />, rootElement);

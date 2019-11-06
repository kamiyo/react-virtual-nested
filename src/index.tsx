import * as React from "react";
import { render } from "react-dom";
import "./styles.css";

import Autosizer from "react-virtualized-auto-sizer";
import {
  VirtualList,
  RowRendererProps,
} from "./VirtualList";

import "./styles.css";

const data = [];
for (let i = 0; i < 35; ++i) {
  data[i] = {
    items: Array.from({ length: (i % 10) + 2 * i + 5 }).map(
      (v, ii) => `child ${ii}`
    )
  };
}

class NestedRenderer extends React.PureComponent<
  RowRendererProps<number, HTMLDivElement>
  > {
  render() {
    const { data, index, innerRef } = this.props;
    return (
      <div className="nested-data" key={index} ref={innerRef}>
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
      innerRef,
      data,
      nestedList,
    } = this.props;
    return (
      <div className="row-data" key={index} ref={innerRef}>
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
          {nestedList}
        </div>
      </div>
    );
  }
}

const loadMore = async () => { };

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
                estimatedRowHeights={60}
                levels={2}
                dataKeys={['items']}
                rowRenderers={[RowRenderer, NestedRenderer]}
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

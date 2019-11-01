import * as React from "react";
import debounce from "./debounce";
import bs from "binary-search";

const INITIAL_SIZE = 100;

interface MetaDataMap {
  [key: string]: MetaData;
}

interface MetaData {
  startPos: number;
  height: number;
  measured: boolean;
}

export interface RowRendererProps<T, D> {
  className?: string;
  data: T;
  index: number;
  style: React.CSSProperties;
  parentOffset: number;
  scrollTop: number;
  height: number;
  innerRef: React.Ref<D>;
}

export type RowRendererType<T, D> = React.ComponentType<RowRendererProps<T, D>>;

interface VirtualListProps<T, D> {
  data: T[];
  rowRenderer: RowRendererType<T, D>;
  height: number;
  className?: string;
  estimatedRowHeight?: number;
}

type UIEventHandlerWithDispatch = (
  event: Event,
  scrollTop: number,
  setScrollTop: React.Dispatch<React.SetStateAction<number>>
) => void;

const scrollHandler: UIEventHandlerWithDispatch = (
  event,
  scrollTop,
  setScrollTop
) => {
  if (event.target) {
    const _scrollTop = (event.target as HTMLDivElement).scrollTop;
    if (_scrollTop !== scrollTop) setScrollTop(_scrollTop);
  }
};

const throttledScrollHandler = debounce(scrollHandler);

interface MeasurerProps<T, D> {
  index: number;
  renderer: RowRendererType<T, D>;
  reportTop: (index: number, startPos: number, size: number) => void;
  data: T;
  style: React.CSSProperties;
  className: string;
  measured: boolean;
  parentOffset: number;
  scrollTop: number;
  height: number;
  callback: (...args: any) => void;
}

class Measurer<T, D> extends React.PureComponent<MeasurerProps<T, D>> {
  ref: React.RefObject<D>;

  constructor(props: MeasurerProps<T, D>) {
    super(props);
    this.ref = React.createRef<D>();
  }

  measure = () => {
    if (!this.props.measured && this.ref.current) {
      console.log(this.props.index, this.props.parentOffset, "measuring");
      this.props.reportTop(
        this.props.index,
        ((this.ref.current as any) as HTMLElement).offsetTop,
        ((this.ref.current as any) as HTMLElement).getBoundingClientRect()
          .height
      );
      if (this.props.callback) this.props.callback();
    }
  };

  componentDidMount() {
    this.measure();
    this.props.updateForcer && this.props.updateForcer();
  }

  componentDidUpdate() {
    this.measure();
  }

  render() {
    const { renderer, measured, ...rest } = this.props;

    const Renderer = renderer;
    return <Renderer {...rest} innerRef={this.ref} />;
  }
}

interface BaseVirtualListProps<T, D> extends VirtualListProps<T, D> {
  scrollTop: number;
  rowCache: RowCache;
  parentOffset?: number;
  callback: (...args: any) => void;
}

interface VirtualListWithCacheProps<T, D> extends VirtualListProps<T, D> {
  scrollTop: number;
}

// The nice thing about this binary search library is it returns
// a negative index for not found, where the negative index
// is related to where the item SHOULD be if it exists.
// i.e. -1 = it should be in the 0th position (push the 0th element back one)
// -2 = 1st element. Since we're searching for the startPos of each row,
// if you want the current topmost element, you should subtract 1, hence
// pass in before = true;
const normalizeBinarySearchResult = (
  index: number,
  before: boolean = false
) => {
  return index >= 0 ? index : -1 * index - 1 - +before;
};

// Parent offset allows us to use the VirtualList nested
const binarySearchComparator = (parentOffset: number) => (
  md: MetaData,
  n: number
) => md.startPos + parentOffset - n;

export const BaseVirtualList: <T, D>(
  props: BaseVirtualListProps<T, D>
) => React.ReactElement<BaseVirtualListProps<T, D>> = ({
  scrollTop,
  rowCache,
  parentOffset = 0,
  ...props
}) => {
  const [startIndex, setStartIndex] = React.useState<number>(0);
  const [endIndex, setEndIndex] = React.useState<number>(0);
  const [updateForcer, setUpdateForcer] = React.useState<number>(0);

  React.useEffect(() => {
    if (rowCache.cache.length !== 0 && props.height !== null) {
      let _startIndex = bs(
        rowCache.cache,
        scrollTop,
        binarySearchComparator(parentOffset)
      );
      _startIndex = Math.max(0, normalizeBinarySearchResult(_startIndex, true));

      const containerToElementRatio =
        props.height / rowCache.estimatedRowHeight;
      const scan = Math.ceil(containerToElementRatio);
      _startIndex -= scan; // underscan
      setStartIndex(Math.max(0, _startIndex));
      let _endIndex = bs(
        rowCache.cache,
        scrollTop + props.height,
        binarySearchComparator(parentOffset)
      );
      _endIndex = normalizeBinarySearchResult(_endIndex);
      _endIndex += scan; // overscan
      setEndIndex(Math.min(props.data.length - 1, _endIndex));
    }
  }, [
    scrollTop,
    props.height,
    rowCache.cache,
    rowCache.estimatedRowHeight,
    parentOffset,
    props.data.length
  ]);

  let children: React.ReactElement[] = [];
  children.push(
    React.createElement("div", {
      key: "placeholder",
      className: "placeholder",
      style: {
        height:
          !!startIndex && !!rowCache.cache.length
            ? rowCache.cache[startIndex].startPos
            : 0
      }
    })
  );
  for (let i = startIndex; i <= endIndex; i++) {
    children.push(
      <Measurer
        className=""
        data={props.data[i]}
        index={i}
        style={null}
        key={i}
        renderer={props.rowRenderer}
        reportTop={rowCache.updateCache}
        measured={rowCache.cache[i].measured}
        parentOffset={rowCache.cache[i].startPos}
        scrollTop={scrollTop}
        height={props.height}
      />
    );
  }
  const cssHeight = !!rowCache.totalHeight ? rowCache.totalHeight : "100%";
  return (
    <div
      style={{
        height: cssHeight,
        width: "100%",
        position: "relative"
      }}
    >
      {children}
    </div>
  );
};

interface RowCacheCstorOptions {
  estimatedRowHeight?: number;
  length: number;
  id?: string;
}

let rowCacheCounter = 0;

export class RowCache {
  cache: MetaData[] = [];
  estimatedRowHeight: number;
  totalHeight: number;
  length: number;
  id: string;

  constructor(options: RowCacheCstorOptions) {
    this.reset(options);
  }

  initData() {
    this.cache = Array.from({ length: this.length }).map((v, i) => ({
      startPos: i * this.estimatedRowHeight,
      height: this.estimatedRowHeight,
      measured: false
    }));
    const lastItem = this.cache[this.length - 1];
    this.totalHeight = lastItem.startPos + lastItem.height;
  }

  updateCache = (index: number, pos: number, height: number) => {
    // if (index === 0) console.log(index, pos, height);
    if (index === null || index === undefined) return;
    const thisOne = this.cache[index];
    if (thisOne.measured) {
      return;
    }
    // if (index === 0) console.log("measuring");
    const diff = pos - thisOne.startPos;
    this.cache[index] = {
      measured: true,
      startPos: pos,
      height
    };
    for (let i = index + 1; i < this.cache.length; i++) {
      if (!this.cache[i].measured) {
        this.cache[i].startPos += diff;
      }
    }
    const lastOne = this.cache[this.length - 1];
    this.totalHeight = lastOne.startPos + lastOne.height;
    this.estimatedRowHeight =
      (lastOne.startPos + lastOne.height) / this.cache.length;
  };

  reset(options: Partial<RowCacheCstorOptions>) {
    this.length = options.length || this.length;
    this.estimatedRowHeight = options.estimatedRowHeight || INITIAL_SIZE;
    this.id = options.id || this.id || "" + rowCacheCounter++;
    this.initData();
  }

  remeasure() {
    for (let i = 0; i < this.length; i++) {
      this.cache[i].measured = false;
    }
  }

  resize(options: RowCacheCstorOptions) {
    const appended = options.length > this.length;
    this.estimatedRowHeight =
      options.estimatedRowHeight || this.estimatedRowHeight;
    if (appended) {
      const amount = options.length - this.length;
      const lastStartPos = this.cache[this.cache.length - 1].startPos;
      this.cache = [
        ...this.cache,
        ...Array.from({ length: amount }).map((v, i) => ({
          startPos: lastStartPos + i * this.estimatedRowHeight,
          height: this.estimatedRowHeight,
          measured: false
        }))
      ];
      this.length = options.length;
    } else {
      this.length = options.length;
      this.initData();
    }
  }
}

const listenerOptions: AddEventListenerOptions = {
  passive: true
};

export const VirtualListWithCache: <T, D>(
  props: VirtualListWithCacheProps<T, D>
) => React.ReactElement<VirtualListWithCacheProps<T, D>> = props => {
  const cache = React.useRef<RowCache>(
    new RowCache({
      id: "parent",
      estimatedRowHeight: props.estimatedRowHeight,
      length: props.data.length
    })
  );

  const [updateForcer, setUpdateForcer] = React.useState<number>(0);

  React.useEffect(() => {
    cache.current.reset({ length: props.data.length });
  }, [props.data]);

  return (
    <BaseVirtualList
      {...props}
      callback={() => {
        cache.current && cache.current.remeasure();
      }}
      updateForcer={() => setUpdateForcer(updateForcer + 1)}
      scrollTop={props.scrollTop}
      rowCache={cache.current}
    />
  );
};

const ScrollWrappedList: <T, D>(
  props: VirtualListProps<T, D>
) => React.ReactElement<VirtualListProps<T, D>> = props => {
  const [scrollTop, setScrollTop] = React.useState<number>(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const callback = React.useCallback(
    (event: Event) => {
      const savedEvent = event;
      throttledScrollHandler(savedEvent, scrollTop, setScrollTop);
    },
    [scrollTop, setScrollTop]
  );

  React.useEffect(() => {
    if (ref.current) {
      ref.current.addEventListener("scroll", callback, listenerOptions);
    }

    const currentRef = ref.current;

    return () =>
      currentRef.removeEventListener("scroll", callback, listenerOptions);
  }, [ref, callback]);

  return (
    <div
      tabIndex={0}
      ref={ref}
      style={{ height: props.height, overflowY: "scroll" }}
    >
      <VirtualListWithCache {...props} scrollTop={scrollTop} />
    </div>
  );
};

export const VirtualList = ScrollWrappedList;

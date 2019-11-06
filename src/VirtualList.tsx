import * as React from "react";
import debounce from "./debounce";
import bs from "binary-search";
import { RowCache, MetaData } from "./RowCache";
import assert from "assert";

export interface RowRendererProps<S, D> {
  className?: string;
  data: S;
  index: number;
  innerRef: React.Ref<D>;
  remeasure: () => void;
  nestedList: React.ReactElement<any, any>;
}

export type RowRendererType<S, D> = React.ComponentType<RowRendererProps<S, D>>;

interface SharedProps<S, D> {
  dataKeys: string[] | string;
  rowRenderers: Array<RowRendererType<S, D>>;
  height: number;
  className?: string;
  estimatedRowHeights?: number[] | number;
}

interface BaseVirtualListProps<T, D> extends SharedProps<T, D> {
  data: T[];
  scrollTop: number;
  rowCache: CacheMap;
  measure?: () => void;
  parentRemeasure?: () => void;
  remeasure?: () => void;
  // subHeights: SubHeights;
  cacheId: string;
  level: number;
}

interface MeasurerProps<T, D> extends Omit<BaseVirtualListProps<T, D>, "data"> {
  index: number;
  datum: T;
  style?: React.CSSProperties;
}

interface VirtualListProps<T, D> extends SharedProps<T, D> {
  data: T[];
  levels: number;
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

class Measurer<T, D> extends React.PureComponent<MeasurerProps<T, D>, { incrementer: number; }> {
  ref: React.RefObject<D>;

  constructor(props: MeasurerProps<T, D>) {
    super(props);
    this.ref = React.createRef<D>();
    this.state = {
      incrementer: 0,
    };
  }

  measure = () => {
    if (this.props.cacheId === "0-2") {
      // console.log(((this.ref.current as any) as HTMLElement).offsetTop,
      //   ((this.ref.current as any) as HTMLElement).getBoundingClientRect())
    }
    if (this.props.rowCache && this.ref.current) {
      this.props.rowCache[this.props.cacheId].updateCache(
        this.props.index,
        ((this.ref.current as any) as HTMLElement).offsetTop,
        ((this.ref.current as any) as HTMLElement).getBoundingClientRect()
          .height
      );
      this.props.measure && this.props.measure();
    }
  };

  componentDidMount() {
    this.measure();
  }

  componentDidUpdate() {
    this.measure();
  }

  render() {
    const { measure, ...rest } = this.props;
    const Renderer = this.props.rowRenderers[this.props.level];
    const NestedList =
      <BaseVirtualList
        {...rest}
        level={this.props.level + 1}
        data={this.props.datum[this.props.dataKeys[this.props.level]]}
        dataKeys={this.props.dataKeys}
        cacheId={this.props.cacheId + '-' + this.props.index}
        measure={this.measure}
      />;
    return (
      <Renderer
        index={this.props.index}
        data={this.props.datum}
        remeasure={this.props.remeasure}
        innerRef={this.ref}
        nestedList={NestedList}
      />
    );
  }
}

interface VirtualListWithCacheProps<T, D> extends VirtualListProps<T, D> {
  scrollTop: number;
  measure?: () => void;
  parentRemeasure?: () => void;
  remeasure?: () => void;
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
  return index >= 0 ? index - +before : -1 * index - 1 - +before;
};

// Parent offset allows us to use the VirtualList nested
const binarySearchComparator = (parentOffset: number) => (
  md: MetaData,
  n: number
) => md.startPos + parentOffset - n;

interface BaseVirtualListState {
  startIndex: number;
  endIndex: number;
  innerHeight: number;
}

export class BaseVirtualList<T, D> extends React.PureComponent<BaseVirtualListProps<T, D>, BaseVirtualListState> {
  state = {
    startIndex: 0,
    endIndex: 0,
    innerHeight: this.props.rowCache ? this.props.rowCache[this.props.cacheId].totalHeight : 0,
  };
  ref: React.RefObject<HTMLDivElement>;

  constructor(props: BaseVirtualListProps<T, D>) {
    super(props);
    this.ref = React.createRef<HTMLDivElement>();
  }

  checkAndStoreCacheCallback = () => {
    this.props.rowCache && !this.props.rowCache[this.props.cacheId].callback
      && this.props.rowCache[this.props.cacheId].setCallback(
        (totalHeight: number) => this.setState({
          ...this.state,
          innerHeight: totalHeight,
        })
      );
  }

  componentDidMount() {
    this.checkAndStoreCacheCallback();
    this.updateIndices();
    this.props.parentRemeasure && this.props.parentRemeasure();
  }

  componentDidUpdate(prevProps: BaseVirtualListProps<T, D>, prevState: BaseVirtualListState) {
    this.checkAndStoreCacheCallback();
    if (prevProps.scrollTop !== this.props.scrollTop ||
      prevProps.height !== this.props.height ||
      prevProps.data.length !== this.props.data.length ||
      prevState.innerHeight !== this.state.innerHeight) {
      this.updateIndices();
    }
    this.props.parentRemeasure && this.props.parentRemeasure();
  }

  componentWillUnmount() {
    this.props.rowCache && this.props.rowCache[this.props.cacheId].setCallback(null);
  }

  updateIndices = () => {
    const {
      rowCache,
      height,
      scrollTop,
      data,
      cacheId,
    } = this.props;
    const thisCache = rowCache[cacheId];
    if (thisCache && thisCache.cache.length !== 0 && height !== null && this.ref.current) {
      const offset = this.ref.current.offsetTop;
      this.props.cacheId === '0-8' && console.log(offset);
      let _startIndex = bs(
        thisCache.cache,
        scrollTop,
        binarySearchComparator(offset)
      );
      this.props.cacheId === '0-8' && console.log(_startIndex);

      _startIndex = Math.max(0, normalizeBinarySearchResult(_startIndex, true));
      const containerToElementRatio =
        0.5 * height / thisCache.estimatedRowHeight;
      const scan = Math.ceil(containerToElementRatio);
      this.props.cacheId === '0-8' && console.log("scan", scan);
      _startIndex -= scan; // underscan
      let _endIndex = bs(
        thisCache.cache,
        scrollTop + height,
        binarySearchComparator(offset)
      );
      _endIndex = normalizeBinarySearchResult(_endIndex);
      _endIndex += scan; // overscan
      this.setState({
        startIndex: Math.max(0, _startIndex),
        endIndex: Math.min(data.length - 1, _endIndex),
      });
    }
  }

  render() {
    const { scrollTop,
      rowCache,
      cacheId,
      level,
      ...props
    } = this.props;
    const {
      startIndex,
      endIndex,
    } = this.state;
    const thisCache = rowCache[cacheId];
    let children: React.ReactElement[] = [];
    children.push(
      React.createElement("div", {
        key: "placeholder",
        className: "placeholder",
        style: {
          height:
            !!startIndex && !!thisCache.cache.length
              ? thisCache.cache[startIndex].startPos
              : 0
        }
      })
    );
    if (thisCache && thisCache.cache.length) {
      for (let i = startIndex; i <= endIndex; i++) {
        children.push(
          <Measurer
            className=""
            datum={this.props.data[i]}
            index={i}
            key={i}
            rowRenderers={this.props.rowRenderers}
            cacheId={cacheId}
            rowCache={rowCache}
            scrollTop={scrollTop}
            height={this.props.height}
            measure={this.props.measure}
            remeasure={this.props.remeasure}
            parentRemeasure={this.props.parentRemeasure}
            level={level}
            dataKeys={this.props.dataKeys}
          />
        );
      }
    }
    const cssHeight = this.state.innerHeight;
    return (
      <div
        style={{
          height: cssHeight,
          width: "100%",
          position: "relative"
        }}
        ref={this.ref}
      >
        {children}
      </div>
    );
  }
};

const listenerOptions: AddEventListenerOptions = {
  passive: true
};

interface CacheMap {
  [key: string]: RowCache;
}

interface SubHeights {
  [key: string]: number;
}

export class VirtualListWithCache<T, D> extends React.PureComponent<VirtualListWithCacheProps<T, D>, { /*subHeights: SubHeights;*/ }> {
  caches: CacheMap = {};

  makeCache = (id: string, currentLevel: number, levels: number, estimatedRowHeights: number[], dataKeys: string[], dataObj: any[]) => {
    if (currentLevel === levels) return;
    this.caches[id] = new RowCache({
      id,
      estimatedRowHeight: estimatedRowHeights[currentLevel],
      length: dataObj.length,
    });
    for (let i = 0; i < dataObj.length; i++) {
      const innerId = id + '-' + i;
      this.makeCache(innerId, currentLevel + 1, levels, estimatedRowHeights, dataKeys, dataObj[i][dataKeys[currentLevel]]);
    }
  }

  constructor(props: VirtualListWithCacheProps<T, D>) {
    super(props);
    if (!this.props.height) return;
    const {
      levels = 1,
      estimatedRowHeights,
      data,
      dataKeys,
      rowRenderers,
    } = this.props;
    assert(rowRenderers.length === levels, "Must provided number of rowRenderers equal to levels.");
    assert((typeof dataKeys === 'string') || dataKeys.length === (levels - 1), "dataKeys must be either a string or array of strings of levels - 1 length.");
    assert((typeof estimatedRowHeights === 'number') || estimatedRowHeights.length === levels, "estimatedRowHeights must be either a number or array of numbers of levels length.");

    const keys = (typeof dataKeys === 'string')
      ? [...Array.from({ length: levels - 1 }).map(() => dataKeys)]
      : [...dataKeys];

    const rowHeights = (typeof estimatedRowHeights === 'number')
      ? Array.from({ length: levels - 1 }).map(() => estimatedRowHeights)
      : estimatedRowHeights;

    const dataObj = data;
    this.makeCache("0", 0, levels, rowHeights, keys, dataObj);
  }

  render() {
    const props = this.props;
    return (
      <BaseVirtualList
        {...props}
        scrollTop={props.scrollTop}
        rowCache={this.caches}
        cacheId={"0"}
        level={0}
        parentRemeasure={props.remeasure}
      />
    );
  }
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
      style={{ height: props.height, overflowY: "scroll", position: "relative" }}
    >
      <VirtualListWithCache {...props} scrollTop={scrollTop} />
    </div>
  );
};

export const VirtualList = ScrollWrappedList;

let rowCacheCounter = 0;
const INITIAL_SIZE = 100;

export interface MetaData {
    startPos: number;
    height: number;
    measured: boolean;
}

interface RowCacheCstorOptions {
    estimatedRowHeight?: number;
    length: number;
    id?: string;
    callback?: (subHeight: number) => void;
}

export class RowCache {
    cache: MetaData[] = [];
    estimatedRowHeight: number;
    totalHeight: number;
    length: number;
    id: string;
    callback: (subHeight: number) => void = null;

    constructor(options: RowCacheCstorOptions) {
        // this.callback = options.callback;
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

    setCallback = (fn: (totalHeight: number) => void) => {
        this.callback = fn;
    }

    updateCache = (index: number, pos: number, height: number) => {
        if (index === null || index === undefined) return;
        const thisOne = this.cache[index];
        const heightDiff = height - thisOne.startPos;
        const diff = pos - thisOne.startPos;
        if (diff === 0 && heightDiff === 0) {
            this.cache[index].measured = true;
            return;
        }
        this.cache[index] = {
            measured: false,
            startPos: pos,
            height
        };
        for (let i = index + 1; i < this.cache.length; i++) {
            if (!this.cache[i].measured) {
                this.cache[i].startPos += diff;
            }
        }
        const lastOne = this.cache[this.length - 1];
        const totalHeight = lastOne.startPos + lastOne.height;
        if (totalHeight === this.totalHeight) {
            return;
        }
        this.totalHeight = totalHeight;
        this.estimatedRowHeight = totalHeight / this.cache.length;
        this.callback && this.callback(this.totalHeight);
    };

    reset(options: Partial<RowCacheCstorOptions>) {
        this.length = options.length || this.length;
        this.estimatedRowHeight = options.estimatedRowHeight || INITIAL_SIZE;
        this.id = options.id || this.id || "" + rowCacheCounter++;
        this.initData();
    }

    remeasure = () => {
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
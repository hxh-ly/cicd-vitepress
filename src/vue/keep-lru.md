## 算法实现

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    let item = this.cache.get(key);
    if (!item) {
      return -1;
    }
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  set(key, value) {
    let item = this.cache.get(key);
    if (item) {
      this.cache.delete(key);
    }
    if (this.cache.size() === this.capacity) {
      // 删除最后一个
      const oldestKey = this.cache.keys()[0];
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}
//注： JavaScript 的 Map 天然维护插入顺序，可简化实现
```

## Vue 的 KeepAlive 实现
Vue(2.x)源码简化
```js
export default {
  name: "keep-alive",
  abstract: true, // 抽象组件，不渲染真实 DOM
  props: {
    include: [String, RegExp, Array], // 需缓存的组件
    exclude: [String, RegExp, Array], // 不缓存的组件
    max: [Number, String], // 最大缓存数量
  },
  created() {
    this.cache = Object.create(null); // 缓存组件实例：{ key: vnode }
    this.keys = []; // 记录缓存顺序（用于 LRU）
  },
  destroyed() {
    // 销毁时清空所有缓存
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys);
    }
  },
  mounted() {
    // 监听 include/exclude 变化，更新缓存
    this.$watch("include", (val) => {
      pruneCache(this, (name) => matches(val, name));
    });
    this.$watch("exclude", (val) => {
      pruneCache(this, (name) => !matches(val, name));
    });
  },
  render() {
    // ... 省略获取子组件 vnode 的逻辑 ...
    const key =
      vnode.key ||
      componentOptions.Ctor.cid +
        (componentOptions.tag ? `::${componentOptions.tag}` : "");

    // 若已缓存，直接复用
    if (this.cache[key]) {
      vnode.componentInstance = this.cache[key].componentInstance;
      // 刷新 key 位置（移到末尾，标记为“最近使用”）
      this.keys.splice(this.keys.indexOf(key), 1);
      this.keys.push(key);
    }
    // 未缓存且需缓存
    else if (shouldCache) {
      this.cache[key] = vnode;
      this.keys.push(key);
      // 超过 max，删除最久未使用的（keys[0]）
      if (this.max && this.keys.length > parseInt(this.max)) {
        pruneCacheEntry(this.cache, this.keys[0], this.keys);
      }
    }

    return vnode;
  },
};
```

### 总结
- LRU 是一种 “淘汰最近最少使用项” 的缓存策略，通过 “哈希表 + 双向链表” 实现高效访问和更新。
- Vue 的 keep-alive 基于 LRU 策略缓存组件实例，减少频繁切换时的性能损耗，核心是 cache 缓存实例、keys 维护顺序，并通过 max 触发 LRU 淘汰。
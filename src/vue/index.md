## Vue3 的几大系统

### 1. 响应式系统

核心作用：实现数据与视图的自动同步，当数据变化时，依赖该数据的视图或逻辑自动更新。

核心实现：基于 Proxy 和 Reflect，通过代理对象拦截数据的访问、修改、删除等操作，实现对数据变化的全面监听。
关键特性：

- 支持对象、数组、Map、Set 等多种数据类型；
- 原生支持新增 / 删除属性、数组索引修改（无需像 Vue2 那样依赖 $set）；
- 采用 “懒代理” 模式：访问嵌套对象时才递归创建响应式，提升初始化性能；
- 提供 reactive（代理对象）、ref（包装基本类型）、computed（计算属性）等 API。

### 2. 组件系统

核心作用：提供组件化开发的基础能力，包括组件定义、通信、生命周期管理等。
核心改进：

- Composition API：替代 Vue2 的 Options API，通过 setup 函数、ref、reactive、watch 等函数组织逻辑，更灵活地复用代码（如自定义 Hooks）；
- 组件通信：保留 props/emit 基础通信方式，新增 v-model 多绑定（如 v-model:title）、defineProps/defineEmits 编译宏简化类型定义；
- 组件生命周期：通过 onMounted、onUpdated 等生命周期钩子函数（替代 Vue2 的选项式生命周期），与 Composition API 更契合；
- 组件注册：支持全局注册（app.component）和局部注册，类型支持更完善（配合 TypeScript）。

### 3. 编译系统（Compiler System）

核心作用：将 Vue 模板（template）编译为高效的渲染函数（render），优化运行时性能。
核心优化：

- 静态提升（Static Hoisting）：将模板中不变的静态节点（如纯文本、无绑定的元素）提升到渲染函数外，避免每次渲染重复创建；
- PatchFlag 标记：为动态节点添加标记（如 TEXT、CLASS），在更新时只对比有变化的部分，减少 Diff 开销；
- 缓存事件处理函数（CacheHandler）：对 @click 等事件绑定的函数进行缓存，避免每次渲染创建新函数导致的不必要更新；
- 树摇优化：编译产物仅包含应用实际使用的功能（如未用 v-if 则不引入相关代码），减小打包体积。

### 4. 渲染系统（Render System）

核心作用：将渲染函数（render）转换为真实 DOM，并处理视图更新（Diff 算法）。
核心流程：

- 初始化渲染：根据渲染函数创建虚拟 DOM（VNode），再将 VNode 转换为真实 DOM 并挂载到页面；
- 更新渲染：数据变化触发重新执行渲染函数生成新 VNode，通过 Diff 算法对比新旧 VNode，只更新差异部分（最小化 DOM 操作）；
- 调度机制：采用 “微任务优先 + 优先级调度” 策略，将多次连续更新合并为一次，避免频繁 DOM 操作导致的性能问题（如 nextTick 机制）。

### 5. 依赖注入系统（Dependency Injection）

核心作用：解决跨层级组件通信问题（替代复杂的 props 层层传递）。
核心 API：

- provide：在父组件中定义需要传递的数据或方法；
- inject：在子组件（无论层级多深）中获取父组件 provide 的数据；
  特点：
- 支持响应式：provide 的数据若为响应式对象（reactive/ref），子组件 inject 后能感知数据变化；
- 类型友好：配合 TypeScript 可明确注入数据的类型，减少运行时错误。

### 6.模板系统（Template System）

核心作用：提供声明式的模板语法，简化视图开发（Vue 的特色之一）。
核心能力：

- 指令系统： `v-if/v-else`、`v-for`、`v-bind`、`v-on`、`v-model`封装常见 DOM 操作逻辑；
- 插槽（Slot）：支持组件内容分发，包括默认插槽、具名插槽（v-slot:name）、作用域插槽（传递数据给父组件）；
- 模版表达式：支持在模板中直接使用 JavaScript 表达式（如 {{ count + 1 }}），由编译系统处理为安全的代码。

## 什么是 PatchFlag

是编译系统对模版静态分析后，为`动态虚拟DOM节点（VNode）添加的标记`。核心作用**是告诉渲染系统：节点中哪部分是动态变化的，从而在更新只针对这些动态部分进行对比和更新，避免全量 Diff 的开销**

### 为什么需要 PatchFLag

vue 是数据驱动试图，数据变会触发组件重新渲染，生成新的 vdom，在 diff 最终少量更新。 patchFlag 可以在编译阶段标记节点的**动态内容**（文本、类名、动态属性），渲染系统在 Diff 会跳过静态内容。只处理带标记的动态部分。

### 工作原理

1. 编译阶段标记动态内容

```html
<template>
  <p>Hello, {{ name }}!</p>
</template>
```

编译后盛出的渲染函数，p 标签的 Vnode 会被标记为`PatchFlag.TEXT` 

1. 更新阶段只处理标记内容
当数据变化触发重新渲染时，新生成的 VNode 会携带相同的 PatchFlag。渲染系统对比新旧 VNode 时，会**根据 PatchFlag 直接定位到动态部分（如文本、属性等）**，只检查这些部分是否变化，忽略静态内容。

### 常见的类型

| 标记常量                | 含义说明                                  | 实例场景                                                        |
| ----------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| TEXT                    | 节点包含动态文本（如 {{ name }}）         | `<p>{{ message }}</p>`                                          |
| CLASS                   | 节点类名是动态的（如 :class）             | `<div :class="{ active: isActive }"></div> `                    |
| STYLE                   | 节点样式是动态的（如 :style）             | `<div :style="{ color: textColor }"></div>   `                  |
| PROPS                   | 节点有动态属性（非 class/style）          | `<input :value="username">`                                     |
| FULL_PROPS              | 节点属性包含动态键名（如 :[key]="value"） | `<div :[attrName]="value"></div>  `                             |
| HYDRATE_EVENTS（32）    | 节点有需要 hydration 的事件（SSR 相关）   | `<button @click="handleClick"></button>   `                     |
| STABLE_FRAGMENT（64）   | 稳定的片段（子节点顺序不变）              | `<template v-for="item in list" :key="item.id">  `              |
| KEYED_FRAGMENT（128）   | 带 key 的片段（子节点顺序可能变化）       | ` <template v-for="item in list">（无 key 时，Vue 会自动生成）` |
| UNKEYED_FRAGMENT（256） | 无 key 的片段（性能较差，不推荐）         | 同上，但无 key 且无法自动生成                                   |
| NEED_PATCH（512）       | 节点需要完整 Diff（用于特殊场景）         | 动态组件 `<component :is="comp"/>`                              |

## Vue3 对 Vue2 有什么优势

- 性能更好（编译优化、使用`proxy`等）
- 体积更小
- 更好的`TS`支持
- 更好的代码组织
- 更好的逻辑抽离
- 更好的新功能

## Vu3 和 Vue2 生命周期有什么区别

`options API`生命周期

- `beforeDestroy`改为`beforeUnmount`
- `destroyd`改为`unmounted`
- 其他沿用`vue2`生命周期

`Composition API`生命周期

```js
export default {
name:'LifeCycles',
props:{
    msg:String
},
setup(){
    onBeforeMount(()=>{

    })
    onMounted(()=>{})
    onBeforeUpdate(()=>{})
    onUpdated(()=>{})
    onBeforeUnmounted(()=>{})
    onUnmounted(()=>{})
}
// 兼容vue2生命周期 options API和composition API生命周期二选一
  beforeCreate() {
    console.log('beforeCreate')
  },
  created() {
    console.log('created')
  },
  beforeMount() {
    console.log('beforeMount')
  },
  mounted() {
    console.log('mounted')
  },
  beforeUpdate() {
    console.log('beforeUpdate')
  },
  updated() {
    console.log('updated')
  },
  // beforeDestroy 改名
  beforeUnmount() {
    console.log('beforeUnmount')
  },
  // destroyed 改名
  unmounted() {
    console.log('unmounted')
  }
}
```

## toRef 和 toRefs 如何使用和最佳方式

`toRef`

- 针对一个响应式对象（`reactive`封装的）一个属性，创建一个`ref`，具有响应式
- 两者保持引用关系

`toRefs`

- 将响应式对象(`reactive`封装的)转化为普通对象
- 对象的每个属性都是对象的`ref`
- 两者保持引用关系

```js
function useFeatureX() {
  const state = reactive({
    x: 1,
    y: 2,
  });
  return toRefs(state);
}
export default {
  setup() {
    const { x, y } = useFeatureX();
    return {
      x,
      y,
    };
  },
};
```

最佳使用方式

- 对象用`reactive`.基本类型用`ref`
- `setup`返回用`toRefs(state)`,部分返回用`toRef(state,'a')`
- `ref`命名用`xxxRef`
- 合成函数返回响应式对象时，用`toRefs`有助于使用方对数据进行解构，不丢失响应式

## 为什么需要 toRef 和 toRefs

- 初衷：不丢失响应式的情况下，把对象数据`分散/扩散`
- 前端：针对的谁响应式对象（`reactive`封装）非普通对象
- 注意：不创造响应式，而是延续响应式

## vue3 升级了哪些功能

|特性类别|Vue2|Vue3|
|---|---|---|
|响应式系统|使用Object.defineProperty|使用proxy|
|API风格|Options API|Composition API|
|生命周期钩子|beforeCreate、created、beforeMounted、mounted,beforeUpdate,updated,beforeDestory,destoryed|组合式 API 下：onBeforeMount, onMounted, onBeforeUpdate, onUpdated, onBeforeUnmount, onUnmounted|
|模板根节点​|必须单个根节点|支持​​多根节点（Fragments）​​|
|性能优化|虚拟DOM全量Diff|静态提升​​、​​Patch Flag​​ 等编译时优化|
|打包体积|整体打包。体积相对较大|支持 ​​Tree-shaking​​（摇树优化）|
|TypeScript 支持|支持，但通过外部库实现，类型推断较弱|使用 TypeScript 重写​​，提供更好的类型推断和支持|
|新内置组件/特性|无|Teleport​​（传送门）、​​Suspense​​（异步组件）|
|全局 API​|Vue.extend、Vue.nextTick等全局 API|改为​​实例方法​​或​​按需导入​​（如 import { createApp } from 'vue'）|
|v-model|单个组件支持一个v-model|单个组件可支持多个v-model(v-model:title)|


1. createApp

```js
// vue2
const app = new Vue({});
Vue.use();
Vue.mixin();
Vue.component();
Vue.directive();

// vue3
const app = createApp({});
app.use();
app.mixin();
app.component();
app.directive();
```

2. emit

```js
// 父亲
<Hello :msg='msg' @onSayHello='onSayhello'></Hello>

// 子
export default {
  name: "Hello",
  props: {
    msg: String,
  },
  emits: ["onSayHello"],
  setup(props, { emit }) {
    emit("onSayHello", "aaa");
  },
};
```

3. 多事件

```js
<button @click="one($event),two($event)"></button>
```

4. Fragment

```html
<template>
  <div>
    <h2>{{title}}</h2>
    <p>vue2</p>
  </div>
</template>

<!-- vue3 不在使用div节点包裹 -->
<template>
  <h2>{{title}}</h2>
  <p>vue3</p>
</template>
```

5. 移除`.sync`，使用`v-model:props`
   vue2`.sync`的用法(双向更新)

- 本质上`props`+ `update:props`事件的封装

```js
// parent
<Hello :title.sync=“parentTitle”></Hello>
// 子
this.$emit('update:title',newVal);

// 多个sync组件的场景 结合v-bind使用
<Child v-bind:sync='{title:titleParent,content:contentParent}'></Child>
// 等价于
<Child
  :title.sync="parentTitle"
  :content.sync="parentContent"
/>
```

vue3 使用`v-model`

```js
// 父亲
<Child v-model:title="titleParent"></Child>;
// 子
this.$emits("update:title", newVal);
```

6. 异步组件
   vue2

```js
new Vue({
  components: {
    "my-component": () => import(".xxx.vue"),
  },
});
```

vue3

```js
export default {
  components: {
    AsyncComponent: defineComponent(() => import("./component.vue")),
  },
};
```

7. 移除 filter

- vue2 的用滤器主要用于数据格式化（日期、货币、大小写转换）
- vue3 使用`computed`替代，或使用方法封装，全局函数使用`app.config.globalProperties.$filters = {  }`

```js
// 全局
Vue.filter('formateDate',(value)=>{  })
// 组件局部
export default {
 data() {
    return {
        name:'hello'
    }
 },
 filters:{
    toUpperCase(value) {
        return value.toUpperCase();
    }
 }
}
// 使用
<div>{{ timeStamp| formatDate | toUpperCase }} </div>
```

## 谈谈对 composition api 对理解

理解 Composition API，关键在于明白它解决了什么问题，它的核心思想是什么以及它带来什么优势？

### 核心思想与定位：

**逻辑关注点分离**。Composition Api 的核心设计理念是基于逻辑（而不是选项类型）来组织代码。 vue2 的 options API 一个功能代码（如数据 data、方法 methods、计算属性 computed、生命周期钩子 mounted）会被分散在不同的选项块中，当组件变得复杂时，理解和维护一个功能的完整逻辑需要在这些分散的块之间来回跳转。这被称为“碎片化”

**函数式组合**。Composition API 提供了一套函数式的 API（如 ref、reactive、computed、watch、onMounted），像编写普通 js 函数一样，按功能逻辑将这些 API 组合（Compose）在一起。每个功能相关的所有代码（状态、逻辑、副作用）都紧密组织在在一个代码块或一个单独的函数中。

### 解决的核心的问题

- **Options API 在复杂组件中的维护性问题**：随着组件功能增多，分散在多个选项块导致 **阅读困难、维护困难、逻辑复用局限**
- **更好的 TypeScript 集成**
- **更灵活的逻辑复用**：Composition API**将使得组件逻辑提取和复用变得极其简单和灵活**。比 mixins（命名冲突、来源明确）更清晰；比高阶组件更轻量（避免嵌套）

### 主要优势

- 代码组织更优
- 逻辑复用强大且灵活
- 更好的 TypeScript 支持

## mixins 的核心局限性

- **命名冲突风险（隐式合并）**。问题，多个同名属性/方法时，vue 的合并策略会覆盖或合并，编译无警告。
- **隐藏依赖关系（“黑盒”逻辑）**。问题：mixin 内部可能依赖组件的特定属性/方法，但无显示声明。

```js
export default {
  mounted() {
    this.fetchUser(); // 要求组件必需实现
  },
};
```

- **逻辑碎片化。**问题：单个功能被拆分到多个选项块中。随着组件复杂度提升，维护、阅读困难。
- **复用性受限**。 问题：mixin 时**静态**合并到组件中去的，无法根据条件动态组合。

```js
// 静态无法按需加载
mixins: [MixinA, MixinB, MixinC];
```

- **全局 mixin 的污染风险**

```js
Vue.mixin({
  created() {
    console.log("全局污染");
  },
});
```

- **调试困难（来源不明）**。组件中使用的属性/方法无法追溯来源
- **TypeScript 支持弱**。mixin 注入的属性和方法缺乏类型推导。

### 关键结论

1. mixin 是平面化的合并。多个 mixin 像图层叠加，易产生冲突和隐式耦合。
2. composition API 是 “积木式”组合：通过函数组合显示连接逻辑，保留独立性和可追溯性。
3. 设计哲学差异。mixin 是关注“注入功能”。Composition 关注“如何组织功能”。

## vue3 的变量通过...解构后，还能保持响应式吗

- 扩展运算符会破坏响应式，因为它会将响应式对象的属性值提取为普通值，脱离`Proxy`或`Ref`的拦截
- 恢复响应式的方法
  - 对`reactive` 用`toRef`转为`ref`集合在解构；
  - 对单个属性：用` ToRef(obj,'a')`单独转为 ref
  - 对 ref 变量：直接使用原 ref 对象，通过`.value`操作

## vue2 响应式

对组件`data`进行递归遍历，劫持拦截`get`和`set`

1. 初始化响应式(`Observer`)

```js
// 简化原理代码
class Observer {
  constructor(value) {
    this.value = value;
    // 遍历对象属性，添加 getter/setter
    this.walk(value);
  }

  walk(obj) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      // 为每个属性定义 getter/setter
      defineReactive(obj, key, obj[key]);
    }
  }
}

// 核心：为属性添加 getter/setter
function defineReactive(obj, key, val) {
  // 递归处理嵌套对象（让子对象也成为响应式）
  if (typeof val === "object" && val !== null) {
    new Observer(val);
  }

  // Dep 用于收集依赖（Watcher）
  const dep = new Dep();

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    //  getter：访问属性时触发，收集依赖
    get() {
      // 收集依赖（当前活跃的 Watcher 会被添加到 dep 中）
      Dep.target && dep.depend();
      return val;
    },
    // setter：修改属性时触发，通知依赖更新
    set(newVal) {
      if (newVal === val) return; // 值未变则不处理
      val = newVal;
      // 新值如果是对象，需要转为响应式
      if (typeof newVal === "object" && newVal !== null) {
        new Observer(newVal);
      }
      // 通知所有依赖（Watcher）更新
      dep.notify();
    },
  });
}
```

2. 依赖收集和更新（`Dep`和`Watcher`）

- `Dep`:每个响应式属性对应一个`Dep`实例，用于存储依赖该属性的`Watcher`（观察者）
- `Watcher`:组件渲染、计算属性、`watch`选项都会创建`Watcher`,当依赖的属性发生变化时，`Watcher`会触发组件重新渲染或回调执行。

流程：

- 组件渲染时，会触发属性的`getter`，此时`Dep.target`指向当前组件的`Watcher`,`dep.depend`会将`Watcher`加入依赖列表
- 当属性被修改，`setter`会调用`dep.notify()`，通知所有`watcher`执行更新（如重新渲染组件）

附：Vue2 如何监听数组修改（重写方法）

```js
// 复制原型，
// 重改方法

// 保存数组原生方法
const arrayProto = Array.prototype;
// 创建一个新对象，原型指向数组原生方法（避免污染原生数组）
const arrayMethods = Object.create(arrayProto);

// 需要重写的 7 个方法
const methodsToPatch = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
];

methodsToPatch.forEach((method) => {
  arrayMethods[method] = function (...args) {
    // 执行原生方法（如 push 实际添加元素）
    const result = arrayProto[method].apply(this, args);
    // 获取当前数组的 Observer 实例
    const ob = this.__ob__;
    // 对于新增元素的情况（如 push、unshift、splice），需要将新元素转为响应式
    let inserted;
    switch (method) {
      case "push":
      case "unshift":
        inserted = args; // 新增的元素是传入的参数
        break;
      case "splice":
        inserted = args.slice(2); // splice 的第三个参数及以后是新增元素
        break;
    }
    if (inserted) {
      ob.observeArray(inserted); // 将新增元素转为响应式
    }
    // 通知依赖更新
    ob.dep.notify();
    return result;
  };
});
```

## vue2 vue3 响应式实现的区别

Vue3 采用 Proxy 实现响应式，与 Vue2 的 Object.defineProperty 相比，存在以下核心区别：
|特点|Vue2|Vue3|
|---|---|---|
| 劫持粒度 | 只能劫持对象单个属性，需要遍历所有属性 | 直接劫持整个对象，无需遍历属性 |
| 新增/删除属性 | 无法直接监听，`Vue.set/this.$set` | 自动监听 |
| 数组监听 | 需重写数组原型的方法 | 原生支持监听数组方法和索引修改 |
| 嵌套对象处理 |需要递归所有嵌套属性，成本高| 懒劫持（访问嵌套对象时转化为响应式），更高效 |

## vue3 实现响应式

核心原理：**基于 Proxy 的代理机制 + 副作用函数依赖管理**。`proxy`直接代理整个对象，几乎可以拦截对象的所有操作`增删改查`

1. 基本流程：创建响应式对象

```js
function reactive(target) {
    return new Proxy(target,{
        get(target,key,receiver) {
            // 反射获取原始值（确保正确处理继承属性）
            const result = Reflect.get(tareget,key,receiver);
            // 收集依赖
            track(target,key);
            if(isObject(result)) {
                // 懒代理，访问是才处理
                reactive(result)
            }
            return result;
        }
        set(target,key,receiver){
            // 1. 先获取旧值
            const oldValue = Reflect.get(target, key, receiver);
            // 2. 若值未变化，直接返回（避免无效更新）
            if (oldValue === value) return true;
            // 3. 反射修改原始值
            const result = Reflect.set(target, key, value, receiver);
            // 4. 触发依赖更新（通知所有依赖该属性的副作用函数执行）
            trigger(target,key);
            return result;
        }

        deleteProperty(target,key) {
            // 1. 反射删除属性
            const result = Reflect.deleteProperty(target, key);
            // 2. 触发依赖更新
            trigger(target, key);
            return result;
        }
    })
}
```

2. 依赖收集与触发更新
   Vue3 通过`副作用函数(Effect)`管理依赖：组件渲染、`watch`回调、计算属性等都是副作用函数。当响应式对象的属性被访问时，会“收集”当前副作用函数；当属性修改时，会“触发”所有收集到的副作用函数执行（如重新渲染组件）、

- 依赖收集。tarck 函数的作用：记录“哪个对象的哪个属性被哪个副作用函数依赖”，存储在一个全局的依赖映射表(`targetMap`)

```js
const targetMap = new WeakMap();
// key是target，value是该对象的属性依赖表(depsMap)
// depsMap:键是属性名（key）、值是依赖该属性的副作用函数集合（Set<Effect>)

function tarck(target, key) {
  //1.如果没有活跃的副作用函数，直接返回
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  //2.获取depsMap，不存在则创建
  if (!depMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  //3.从depMap获取副作用集合（dep），不存在就创建
  let dep = depMap.get(key);
  if (!dep) {
    depMap.set(key, (dep = new Set()));
  }
  //4.将活跃的副作用函数添加到dep（去重）
  dep.add(activeEffect);
  //5.副作用函数也记住自己被哪些dep依赖（用于清理）
  activeEffect.deps.push(dep);
}
```

- 触发更新（trigger 函数）。`trigger`函数到作用是：当属性变化时，从依赖映射表中找到所有依赖该属性的副作用函数，执行它们（如重新渲染组件）

```js
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return; // 无依赖则直接返回
  // 2. 从 depsMap 中获取当前属性的副作用集合（dep）
  const dep = depsMap.get(key);
  if (!dep) return;
  // 3. 执行所有依赖的副作用函数（复制一份避免执行中修改集合导致死循环）
  const effects = new Set(dep);
  effects.forEach((effect) => effect.run());
}
```

- 处理基本类型：`ref`的实现
  Proxy 只能代理对象。无法直接代理基本类型（number、string）。Vue3 通过`ref`解决这问题。将基本类型包装为一个包含`value`属性的对象，再对`value`进行代理

```js
// 简化版 ref 实现
function ref(value) {
  // 创建一个包装对象，包含 value 属性
  const wrapper = {
    value: value,
  };
  // 为包装对象的 value 属性创建响应式（通过 reactive 代理）
  return reactive(wrapper);
}

// 使用示例
const count = ref(0);
count.value++; // 修改 value 会触发更新（被 Proxy 拦截）
```

## vue3组件能绑定多个v-model
归结为 ​​v-model的参数化​​。它将原本硬编码的 modelValue/update:modelValue这对绑定关系，推广为可任意指定的 arg/update:arg关系。Vue 3 能够实现多个 v-model绑定的核心机制可以概括为以下几点：
1. 参数模型化
```jsx
// 这个参数名决定了 子组件props名称和需要触发的事件名称
<UserForm 
  v-model:username="userName" 
  v-model:age="userAge" 
  v-model:email="userEmail"
/>
```
2. 语法糖展开
```jsx
<UserForm 
  :username="userName" 
  @update:username="userName = $event"
  :age="userAge" 
  @update:age="userAge = $event"
  :email="userEmail" 
  @update:email="userEmail = $event"
/>
```
3. 子组件的约定
- 接受props：通过defineProps接受与参数名同名的prop
- 触发事件：在数据需要更新时，通过 defineEmits定义并触发名为 update:参数名的事件（例如 update:username, update:age）
```js
const props = defineProps(['username', 'age', 'email']);
const emit = defineEmits(['update:username', 'update:age', 'update:email']);

// 针对 username 的局部响应式变量
const localUsername = computed({
  get() {
    return props.username;
  },
  set(value) {
    emit('update:username', value);
  }
});
```
这样，在子组件的输入框中使用 v-model="localUsername"，就能完美地桥接到父组件的双向数据流。

## watch 和 watchEffect 的区别

都是用来做监听响应式数据变化并执行副作用的 api，但它们的**使用方式**和**适用场景**有区别。
|特性|watch|watchEffect|
|---|---|---|
|监听目标|明确指定监听的响应式数据(ref,reactive,getter 函数)| 自动收集函数内部使用的数据 |
|初始化执行|默认初始化不执行，需通过`immediate:true`|初始化自动执行一次（首次允许就收集依赖）|
|新旧值获取|可以获取|无法获取|
|深度监听|对对象，数组，需要设置`deep:true`开启|自动追踪函数内访问的**所有深度响应式数据**|
|停止监听|返回一个停止函数、调用后停止监听(`const stop = watch()` )| 同意返回停止函数，用法一致 |
|清理副作用|返回清理函数，下一次执行前或停止监听会调用| 同上，回调返回清理函数，时机相同 |
|场景| 明确监听目标，需要新旧值，不需要初始化执行 | 依赖多个值联动，需首次执行，无需新旧值，需深度监听 |

## vue2数组会什么会失去响应式
|场景分类|具体操作示例|原因简述|推荐解决方案|
|直接通过索引修改|this.items[0] = newValue|Object.defineProperty无法拦截数组索引的赋值操作|使用 Vue.set(this.items, 0, newValue)或 this.items.splice(0, 1, newValue)|
|直接修改数组长度​|this.items.length = 0|修改 length属性不会被 Object.defineProperty检测到|	使用 this.items.splice(0)来清空数组|
|使用非变异方法|​this.items = this.items.concat([newItem])|方法返回新数组，需用新引用替换旧引用才能触发更新|使用变异方法（如 push）或直接赋值新数组|
`Object.defineProperty`存在一个​​先天限制​​：它主要设计用于对象属性，对于数组的一些操作无法有效拦截。这就是表格中前两类问题的根源。

## vue2数组的变异方法
```js
arr.pop()
arr.push()
arr.shift()
arr.unshift()
arr.splice()
arr.sort()
arr.reverse()
```
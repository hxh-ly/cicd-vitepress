## 解释 TS 中静态类型的概念和好处

概念：提供变量、函数参数、返回值的数据类型
好处：开发早期能捕获类型相关的错误，提升代码质量和可维护性。

## TS 的接口是什么？举个例子

定义对象结构的契约，指定属性和方法

```ts
interface Person {
  say: () => void;
}
```

## 类型断言

无法自动推断类型的时候，允许告诉编辑器变量的类型

## 泛型

允许您创建可与各种类型一起使用的可重用组件或者函数。支持强类型、同时报吹不同数据类型的灵活性

```ts
function identify<T>(args: T): T {
  return T;
}
const a = identify<number>(1);
```

## keyof

是一个类型运算符，它返回表示对象键的文字类型的联合

```ts
interface Person {
  name: string;
  age: number;
}
type PersonKeys = keyof Person; // "name"|'age'
```

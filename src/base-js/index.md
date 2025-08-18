## this 指向

附：箭头函数的特点
设计目的是解决回调函数中 this 指向混乱的问题，让代码更简洁。

- 函数内不绑定 this 指向，this 继承外层作用域的 this
- 无法修改箭头函数的 this，箭头函数的 this 是 “定义时绑定，而非调用时绑定”：
- 无 argument
- 无法 new

### 理解函数调用栈

```html
<script>
  btn.addEventListener("click", function handler() {
    console.log(this); // 请问这里的 this 是什么 this === btn
  });
  btn.addEventListener("click", () => {
    console.log(this); // window
  });

  function baz() {
    console.log("baz 111 当前调用栈在window");
    bar();
  }

  function bar() {
    console.log("bar 222 在调用栈 baz");
    foo();
  }

  function foo() {
    console.log("foo 333 调用栈在bar");
  }
  baz();
</script>
```

### 试题

```js
var name = "a";
var obj = {
  name: "b",
  fee: function () {
    var zz = () => {
      console.log(this.name);
    };
    zz();
  },
};
obj.fee(); //b
c = obj.fee;
c(); //a
```

```js
var a = 3;
function foo() {
  var a = 2;
  console.log(this); //window
  console.log(this.a); // window.a
  obj.doSomething(); // obj undefined
  console.log(this.count);
  undefined;
}
foo.count = 0;
var obj = {
  name: "hxh",
  doSomething() {
    console.log(this); //对象
    console.log(this.a);
  },
};
foo();
```

```js
var ca = {
  render: function () {
    console.log(this);

    this.update();
  },
  update: function () {
    console.log(this);

    console.log("ca");
  },
};
window.setInterval(ca.render(), 1000); // 执行正常，但ca.render() 没有返回会报错。
```

```js
function Super() {
  let count = 1;
  //父级Super  执行上下文的this
  return () => {
    //let 不会出现在window的全局对象中
    console.log(this);
    console.log(count);
  };
}
var obj = {
  way: Super,
  count: "b",
  // 父执行上下文的this
  smile: () => {
    console.log(this);
  },
};
obj.smile(); // 父执行上下文的this ❌ -> window
let b = obj.way(); // 创建时绑定this
b(); //obj 1
```

```js
/* 只有在函数执行产生位置,时this才有意义
      谁调用指向谁
  立即执行指向window（环境）
    独立调用指向window */
let obj = {
  name: "a",
  s1: function () {
    //obj谁调绑定谁
    setTimeout(() => {
      console.log(this);
    }, 0);
  },
};
let obj2 = {
  name: "b",
};
let nums = [1, 2, 3];

let window_s = obj.s1;
window_s(); //window
obj.s1.call(obj2); //obj2
```

```js
var name = "window";
var person = {
  name: "person",
  sayName: function () {
    console.log(this.name);
  },
};

function sayName() {
  console.log(this); //window
  var sss = person.sayName;
  sss(); // window
  person.sayName(); //person
  person.sayName(); //window ❌ 只有函数引用，没保留上下文
  (b = person.sayName)(); //window。引用赋值给b。b() 丢失上下文
}
sayName();
```

```js
var name = "window";
var person1 = {
  name: "person1",
  foo1: function () {
    console.log(this.name);
  },
  foo2: () => {
    console.log(this.name);
  },
  foo3: function () {
    return function () {
      console.log(this.name);
    };
  },
  foo4: function () {
    return () => {
      console.log(this.name);
    };
  },
};
var person2 = { name: "person2" };

person1.foo1(); //person1 ✔
person1.foo1.call(person2); //person2 ✔

person1.foo2(); //window ✔
person1.foo2.call(person2); //window ✔

person1.foo3()(); //window ✔
person1.foo3.call(person2)(); //window ✔
person1.foo3().call(person2); //person2 ✔

person1.foo4()(); //person1 ✔
person1.foo4.call(person2)(); //person2 ✔
person1.foo4().call(person2); //person1✔
```

```js
var name = "window";
function Person(name) {
  this.name = name;
  this.foo1 = function () {
    console.log(this.name);
  };
  this.foo2 = () => console.log(this.name);
  this.foo3 = function () {
    return function () {
      console.log(this.name);
    };
  };
  this.foo4 = function () {
    return () => {
      console.log(this.name);
    };
  };
}
var person1 = new Person("person1");
var person2 = new Person("person2");

person1.foo1(); //p1
person1.foo1.call(person2); //p2

person1.foo2(); //p1
person1.foo2.call(person2); // p1

person1.foo3()(); //window
person1.foo3.call(person2)(); //window
person1.foo3().call(person2); //p2

person1.foo4()(); //p1
person1.foo4.call(person2)(); //p2
person1.foo4().call(person2); //p1
```

## 防抖和截流

### 防抖

频繁触发，当触发后超过 `几百ms(自己设定)`后，则执行一次。

```js
function debounce(cb, delay) {
  let timer;
  return function (...args) {
    clearTimer(timer);
    timer = setTimeout(() => {
      cb.apply(this, ...args);
    }, delay);
  };
}
```

### 截流

每`几百ms（自己设定）`触发一次

`🙂‍↔️





























































































































































































``js
function throttle(cb, delay) {
  let start = 0; // 如果 let start = Date.now() -> 时间相差很短，第一次不执行
  return function (...args) {
    let now = Date.now();
    if (now - start >= delay) {
      cb.apply(this, ...args);
      start = Date.now();
    }
  };
}
```

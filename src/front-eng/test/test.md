## Testing Libiray

**核心定义：** Testing Library 是一组用于测试 UI 组件的工具库，其核心 guiding principle 是：它不是测试组件的*实现细节*（比如内部状态、方法），而是测试组件在界面上的*实际输出*（渲染的 DOM）以及用户的*交互行为*（点击、输入等）。

**家族成员：** 它针对不同的框架或环境提供了相应的包：

- `@testing-library/react`： 用于测试 React 组件。
- `@testing-library/vue`： 用于测试 Vue 组件。
- `@testing-library/angular`： 用于测试 Angular 组件。
- `@testing-library/react-native`： 用于测试 React Native 组件。
- `@testing-library/dom`： 核心的 DOM 操作库，上述库都基于它。
- `@testing-library/user-event`： 一个模拟用户交互的更高级、更逼真的库。

核心理念：

**1. 反对测试“实现细节”**

- 不好的测试(测试实现细节）
- 问题：测试和组件的内部实现紧密耦合。如果你把state.count改为internalCount，或者把类组件重构成函数组件并使用Hooks。测试就会失败。这种测试非常脆弱，重构成本高。

```js
// 测试一个计数器组件
test('不应该这么测：测试实现细节', () => {
  const component = render(<Counter />);
  // 错误：直接访问组件的内部状态和方法
  expect(component.instance().state.count).toBe(0);
  component.instance().increment(); // 直接调用内部方法
  expect(component.instance().state.count).toBe(1);
});
```

**2. 倡导测试“用户行为”**

- 好的测试
- 优点：不关系组件内部是类组件、函数组件、用了什么Hook或者状态管理库。只关心：用户看到一个显示"Count:0"和一个"Increment"按钮。用户点击按钮后，文件有个变成“Count：1”

  ```js
  import { render, screen } from ‘@testing-library/react’;
  import userEvent from ‘@testing-library/user-event’;
  import Counter from ‘./Counter’;

  test(‘应该这么测：像用户一样交互和断言’, async () => {
    // 渲染组件到 DOM
    render(<Counter />);

    // 查询页面上显示的文字（用户看到的内容）
    const countDisplay = screen.getByText(/count: 0/i); // 使用正则表达式忽略大小写
    expect(countDisplay).toBeInTheDocument();

    // 找到按钮并模拟用户点击（用户交互行为）
    const incrementButton = screen.getByRole(‘button’, { name: /increment/i });
    await userEvent.click(incrementButton);

    // 断言显示结果是否变成了用户期望的值
    expect(countDisplay).toHaveTextContent(‘Count: 1’);
  });
  ```

核心api

- render：将组件渲染到一个虚拟的DOM容器中
- screen：一个全局对象，提供多种查询方法来查询虚拟DOM的元素。推荐始终使用screen，而不是从render的返回中解构。
- 查询方法：用于查询元素，这是哲学思想的直接体现。优先级如下：
  - 可访问性查询：getByRole、getByLabelText、getByPlaceholderText
  - 语义查询：getByText
  - 测试ID（最后的选择）：getByTestId，只有当以上方法都无效时，才会使用这个，因为它需要你在生产代码中添加`data-testid`属性
- 用户交互：使用`@testing-library/user-event`来模拟真实的用户事件（如点击、打字），它比内置的`fireEvent`更高级逼真。
- 断言：使用Jest的expect并结合`@testing-library/jest-dom`提供的扩展匹配器，使得断言更加语义化。
- ```js
  expect(element).toBeInTheDocument();
  expect(element).toHaveTextContent(‘Hello’);
  expect(input).toBeDisabled();
  expect(checkbox).toBeChecked();
  ```

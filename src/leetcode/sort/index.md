## 快速排序

思想：分治法

1. 选择基准：从数组中挑一个元素作为基准，通常是中间元素、第一个或者最后一个，简化版选中间。
2. 分区：将数组中小于基准的放在基准左边， 大于基准放在基准右边（等于基准的元素放在任意一边）
3. 递归排序：对基准左边和右边的子数组重复上述操作，直到子数组长度为 0 或者 1（天然有序）
   时间复杂度：递归深度为 log₂n(二叉树的高度)，层数 x 每层时间 = nlog(n)
   空间复杂度：非原地排序，每次递归都创建新数组，总额外空间 O（n）

```js
let arr = [1, 4, 88, 9, 5, 0, 2, 17, 55];
const quickSearch = (list) => {
  console.log("进来打印list" + list);
  if (list.length <= 1) {
    return list;
  }
  let randomIdx = Math.floor(list.length / 2);
  let target = list[randomIdx];
  let left = [];
  let right = [];
  for (let i = 0; i < list.length; i++) {
    if (i === randomIdx) {
      continue;
    }
    if (list[i] < target) {
      left.push(list[i]);
    } else {
      right.push(list[i]);
    }
  }
  if (left.length > 0) {
    left = quickSearch(left);
  }
  if (right.length > 0) {
    right = quickSearch(right);
  }

  return [...left, target, ...right];
};

quickSearch(arr);
```

优化快排：

1. 基准选择 -> 三数取中间，拿基准值
2. 三路快排 -> （小基准、等于基准，大于基准）
3. 小规模数组改用插入排序，n<10 时，（O (n²) 但常数项小）
4. 尾递归优化： 对其中一个子数组用循环代替递归，减少栈深度。

```js
function optimizedQuickSort(arr) {
  // 入口函数：处理边界情况并启动排序
  if (arr.length <= 1) return arr;
  quickSort(arr, 0, arr.length - 1);
  return arr;
}

function quickSort(arr, left, right) {
  // 优化1：小规模数组（长度≤10）用插入排序
  if (right - left + 1 <= 10) {
    insertionSort(arr, left, right);
    return;
  }

  // 优化2：三数取中选择基准
  const pivotIndex = medianOfThree(arr, left, right);
  const pivot = arr[pivotIndex];

  // 优化3：三路划分（小于、等于、大于基准）
  let [lt, gt] = partition3Way(arr, left, right, pivot);

  // 优化4：尾递归优化（对较小的子数组递归，较大的用循环处理）
  if (lt - left < right - gt) {
    quickSort(arr, left, lt - 1);
    // 用循环处理较大的子数组（避免递归栈过深）
    left = gt + 1;
  } else {
    quickSort(arr, gt + 1, right);
    // 用循环处理较大的子数组
    right = lt - 1;
  }

  // 循环继续处理剩余子数组（替代递归）
  if (left < right) {
    quickSort(arr, left, right);
  }
}

// 三数取中：选择left、mid、right的中间值作为基准
function medianOfThree(arr, left, right) {
  const mid = Math.floor((left + right) / 2);
  // 排序三个位置的值，返回中间值的索引
  if (arr[left] > arr[mid]) swap(arr, left, mid);
  if (arr[left] > arr[right]) swap(arr, left, right);
  if (arr[mid] > arr[right]) swap(arr, mid, right);
  return mid; // 此时mid位置的值是中间值
}

// 三路划分：将数组分为 [left, lt-1] < pivot, [lt, gt] = pivot, [gt+1, right] > pivot
function partition3Way(arr, left, right, pivot) {
  let lt = left; // 小于区的右边界
  let gt = right; // 大于区的左边界
  let i = left; // 当前遍历索引

  while (i <= gt) {
    if (arr[i] < pivot) {
      swap(arr, lt++, i++); // 放入小于区，移动指针
    } else if (arr[i] > pivot) {
      swap(arr, i, gt--); // 放入大于区，仅移动gt（i不动，需重新检查交换后的值）
    } else {
      i++; // 等于基准，直接跳过
    }
  }
  return [lt, gt]; // 返回等于区的边界
}

// 插入排序：用于小规模数组
function insertionSort(arr, left, right) {
  for (let i = left + 1; i <= right; i++) {
    const temp = arr[i];
    let j = i;
    while (j > left && arr[j - 1] > temp) {
      arr[j] = arr[j - 1];
      j--;
    }
    arr[j] = temp;
  }
}

// 交换数组元素
function swap(arr, i, j) {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

// 测试
const arr = [3, 6, 8, 10, 1, 2, 1, 5, 5, 5];
console.log(optimizedQuickSort(arr)); // [1, 1, 2, 3, 5, 5, 5, 6, 8, 10]
```

## 堆排

堆是一种完全二叉树结构（除最后一层外，每层都满，最后一层左对齐），分为两种：

- 大顶堆：每个父节点都值 >= 子节点的值 （堆顶是最大值）
- 小顶堆：每个父节点都值 <= 子节点的值 （堆顶是最小值）
- 核心特性：快速定位**父子节点** 【以数组存储堆】
- - 父节点索引： `i` 左子节点：`2i+1`, 右子节点：`2i+2`
- - 子节点索引： `i` 父节点 `Math.floor( (i-1)/2 ) `

### 实现优先级队列

堆是实现优先级队列的最优方式（插入/取值效率高）

## 以大顶堆实现“高优先级元素先出队"

```js
class PiorityQueue {
  constructor() {
    this.heap = [];
  }
  // 插入
  enqueue(value) {
    this.heap.push(value);
    bubbleUp(this.heap.length - 1);
  }
  // 取出
  dequeue() {
    let first = this.heap[0];
    let data = this.heap.pop(); // 最后一个
    if (this.heap.length) {
      this.heap[0] = data;
      sinkDown(0);
    }
    return first;
  }
  //上浮操作
  bubbleUp(index) {
    while (index > 0) {
      let parentIdx = Math.floor((index - 1) / 2);
      if (this.heap[index] <= this.heap[parentIdx]) {
        break;
      }
      [this.heap[index], this.heap[parentIdx]] = [
        this.heap[parentIdx],
        this.heap[index],
      ];
      index = parentIdx;
    }
  }
  //下沉操作
  sinkDown(index) {
    let length = this.heap[this.heap.length-1];
    while (true) {
      let leftIdx = 2 * index + 1;
      let rightIdx = 2 * index + 2;
      let largetIdx = index;
      if (leftIdx<length &&  leftIdx  this.heap[largetIdx] < this.heap[leftIdx]) {
        largetIdx = leftIdx;
      }
      if (rightIdx<length  this.heap[largetIdx] < this.heap[rightIdx]) {
        largetIdx = rightIdx;
      }
      if (largetIdx === index) {
        break;
      }
      [this.heap[index], this.heap[largetIdx]] = [
        this.heap[largetIdx],
        this.heap[index],
      ];
      index = largetIdx;
    }
  }
}

// 测试：高优先级（大数值）先出队
const pq = new PriorityQueue();
pq.enqueue(3);
pq.enqueue(10);
pq.enqueue(5);
console.log(pq.dequeue()); // 10（最大）
console.log(pq.dequeue()); // 5
console.log(pq.dequeue()); // 3
```

## 堆排

思想：

1. 构建大顶堆：将无序数组转换为大顶堆（确保每个父节点 ≥ 子节点）。
2. 排序：
   - 交换堆顶（最大值）与数组末尾元素（此时最大值已就位）。
   - 排除末尾元素，对剩余元素重新调整为大顶堆。
   - 重复上述步骤，直到所有元素有序。

```js
function heapSort(arr) {
  // 从最后一个非节点向前上升调整，
  for (let i = Math.floor(arr.length / 2) - 1; i >= 0; i--) {
    sinkDown(arr, i, arr.length);
  }
  // 交换头尾位置，
  for (let end = arr.length - 1; end > 0; end--) {
    [arr[0], arr[end]] = [arr[end], arr[0]];
    sinkDown(arr, 0, end);
  }
  return arr;
}
```

## 三数之和（Leetcode 15）

给你一个整数数组 nums ，判断是否存在三元组 [nums[i], nums[j], nums[k]] 满足 i != j、i != k 且 j != k ，同时还满足 nums[i] + nums[j] + nums[k] == 0 。请你返回所有和为 0 且不重复的三元组。

```
示例1:
nums = [-1,0,1,2,-1,-4]
[[-1,-1,2],[-1,0,1]]

示例2:
[0,1,1]
[]
```

思想：

1. 数组有序排序
1. 剪枝-如果最小值>0（说明不可能构成三数之和为 0），break
1. 判断-如果相邻等数相等如（nums[i]===nums[i-1]），只算一次
1. 遍历：从头遍历，另外 2 个数需要从头尾取
1. 遍历：承接上 3，分`===sums` `<sums` `>sums`的情况移动` L``R `

```js
/**
 * @param {number[]} nums
 * @return {number[][]}
 */
var threeSum = function (nums) {
  let res = [];
  let len = nums.length;
  if (nums.length < 3) {
    return res;
  }
  nums.sort((a, b) => a - b);
  for (let i = 0; i < len; i++) {
    if (i === 0 && nums[i] > 0) {
      break;
    }
    if (i > 0 && nums[i] === nums[i - 1]) {
      continue; // 去重
    }
    let L = i + 1;
    let R = len - 1;
    while (L < R) {
      const sums = nums[i] + nums[L] + nums[R];
      if (sums == 0) {
        res.push([nums[i], nums[L], nums[R]]);
        while (L < R && nums[L] === nums[L + 1]) {
          L++; // 去重
        }
        while (L < R && nums[R] === nums[R - 1]) {
          R++; // 去重
        }
        L++;
        R--;
      } else if (sum < 0) {
        L++;
      } else if (sum > 0) {
        R++;
      }
    }
  }
  return res;
};
```

## 80.删除有序数组中的重复项||

思想：用栈的想法
以`[1,1,1,2,2,3]`为例子
|栈元素|栈顶下面的一个元素|当前|是否可入|
|---|---|---|---|
|[1,1]|1|1|否|
|[1,1]|1|2|可|
|[1,1,2]|1|2|可|
|[1,1,2,2]|2|3|可|
|[1,1,2,2,3]||||

```js
var removeDuplicates = function (nums) {
  let statckSize = 2;
  for (let i = 2; i < nums.length; i++) {
    if (nums[i] !== nums[statckSize - 2]) {
      nums[statckSize] = nums[i];
      statckSize++;
    }
  }
  return Math.min(statckSize, nums.length);
};
```

```js
// 双指针
var removeDuplicates = function (nums) {
  let slow = 2;
  let fast = 2;
  while (fast < nums.length) {
    // 满足继续，不满足等待被替换
    if (nums[slow - 2] != nums[fast]) {
      nums[slow] = nums[fast];
      slow++;
    }
    fast++;
  }
  return slow;
};
```

## 反转链表

思想：使用哨兵节点`pre`
步骤：

- 保留 cur.next
- cur 先指向 pre
- pre 向 cur 移动
- cur 向 cur.next 移动
- 最终`cur`为空，返回`pre`

```js
var reverseList = function (head) {
  let pre = null;
  let cur = head;
  let next = null;
  while (cur) {
    next = cur.next;
    cur.next = pre;
    pre = cur;
    cur = next;
  }
  return pre;
};
```

递归方法

```js
var reverseList = function (head) {
  // 总问题：反转链表返回头节点，
  // 子问题：反转部分链表返回头节点
  // 递：递到5，返回5。
  // 归：归到4，修改成  null <- 4 <-5

  // 最终变. null <- 1 <- 2 <- 3 <- 4 <- 5(返回的newHead)
  if (!head || !head.next) {
    return head;
  }
  let new_head = reverseList(head.next);
  head.next.next = head;
  head.next = null;
  return new_head;
};
```

## 删除节点，但不给定头节点

```js
function deleteNode(node) {
  node.val = node.next.val;
  node.next = node.next.next;
}
```

## 二叉树的右视角图

- 递归思想,利用树的深度

```js
// 原问题：树的最右节点
// 子问题：子树的最右节点
function main(root) {
  let res = [];
  // 当深度到了，还没收集，就收集（右先遍历，肯定是右先收集到）
  function dfs(root, deepth) {
    if (!root) {
      return;
    }
    if (deepth === res.length) {
      res.push(root.val);
    }
    dfs(root.right, deepth + 1);
    dfs(root.left, deepth + 1);
  }
  dfs(root, 0);
  return res;
}
```

## 3.无重复字符的最长子串

思想：滑动窗口扩充，遇到重复的时候`左端点已到重复位置`，然后开始新的统计。

```js
var lengthOfLongestSubstring = function (s) {
  let map = new Map();
  let max = 0;
  let left = 0;
  for (let i = 0; i < s.length; i++) {
    let ele = s[i];
    let value = map.get(ele);
    map.set(ele, !value ? 1 : value + 1);
    while (map.get(ele) > 1) {
      // 遇上相同了
      map.set(s[left], map.get(s[left]) - 1);
      left++; // 起点重新算
    }
    max = Math.max(max, i - left + 1); // 每一轮都统计
  }
  return max;
};
```


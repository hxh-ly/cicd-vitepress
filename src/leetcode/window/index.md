(滑动窗口与双指针（定长/不定长/单序列/双序列/三指针/分组循环）)[https://leetcode.cn/discuss/post/3578981/ti-dan-hua-dong-chuang-kou-ding-chang-bu-rzz7/]

# 不定长滑窗

不定长滑动窗口主要分为三类：求最长子数组、求最短子数组、求子数组个数

> 注：滑动窗口相当于在维护一个队列。右指针的移动可以视作入队，左指针的移动可以视作出队。

## 越短越合法/求最长/最大

### 3. 无重复字符的最长子串

题目：给定一个字符串 s ，请你找出其中不含有重复字符的 最长 子串 的长度。

```
示例 1:
输入: s = "abcabcbb"
输出: 3
解释: 因为无重复字符的最长子串是 "abc"，所以其长度为 3。

示例 2:
输入: s = "bbbbb"
输出: 1
解释: 因为无重复字符的最长子串是 "b"，所以其长度为 1。

示例 3:
输入: s = "pwwkew"
输出: 3
解释: 因为无重复字符的最长子串是 "wke"，所以其长度为 3。
     请注意，你的答案必须是 子串 的长度，"pwke" 是一个子序列，不是子串。
```

```js
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
```

### 每个字符最多出现两次的最长子字符串

给你一个字符串 s ，请找出满足每个字符最多出现两次的最长子字符串，并返回该子字符串的 最大 长度。

思路：与`3. 无重复字符的最长子串`类似，这里把 `map.get(item)>1 `改为`>2`

```js
var maximumLengthSubstring = function (s) {
  let map = new Map();
  let max = 0;
  let left = 0;
  for (let i = 0; i < s.length; i++) {
    let ele = s[i];
    let value = map.get(ele);
    map.set(ele, !value ? 1 : value + 1);
    while (map.get(ele) > 2) {
      // 遇上相同了
      map.set(s[left], map.get(s[left]) - 1);
      left++; // 起点重新算
    }
    max = Math.max(max, i - left + 1); // 每一轮都统计
  }
  return max;
};
```

### 1493. 删掉一个元素以后全为 1 的最长子数组

题目：给你一个二进制数组 nums ，你需要从中删掉一个元素。

请你在删掉元素的结果数组中，返回最长的且只包含 1 的非空子数组的长度。

如果不存在这样的子数组，请返回 0 。

```
提示1:
输入：nums = [1,1,0,1]
输出：3
解释：删掉位置 2 的数后，[1,1,1] 包含 3 个 1 。
```

思想：

- 1. 入，收集 0 的频率
- 2. 0 的频率大于 1 的时候，窗口要重新调整（收缩到 0 的频率只有 1 个）
- 3. 变长滑动窗口，因为最后一定要删一个,所以 max 统计的时候是 `Math.max(i-left,max)`

```js
var longestSubarray = function (nums) {
  let map = new Map();
  let max = 0;
  let len = nums.length;
  let left = 0;
  for (let i = 0; i < len; i++) {
    let ele = nums[i];
    let value = map.get(ele);
    map.set(ele, value ? value + 1 : 1);
    while (ele == 0 && map.get(0) > 1) {
      // console.log(i)
      map.set(nums[left], map.get(nums[left]) - 1);
      left++;
    }
    max = Math.max(i - left, max);
  }
  return max;
};
```

### 3634. 使数组平衡的最少移除数目

题目：给你一个整数数组 nums 和一个整数 k。

如果一个数组的 最大 元素的值 至多 是其 最小 元素的 k 倍，则该数组被称为是 平衡 的。

你可以从 nums 中移除 任意 数量的元素，但不能使其变为 空 数组。

返回为了使剩余数组平衡，需要移除的元素的 最小 数量。

注意：大小为 1 的数组被认为是平衡的，因为其最大值和最小值相等，且条件总是成立。

大意：最小值、最大值满足一定的关系，不满足要删除一些元素

```js
// 思想：数组排序， 滑动窗口尽可能的大就行
var minRemoval = function (nums, k) {
  // 排序，最大最小可得到
  let left = 0;
  let max = 0;
  nums.sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    while (nums[left] * k < nums[i]) {
      left++;
    }
    max = Math.max(max, i - left + 1);
  }
  return nums.length - max;
};
```

### 1208. 尽可能使字符串相等

题目大意：给两个字符串`s`,`t`。给出预算`mastCost`，目标是尽可能将`s`的每个字符转化为`t`的每个字符。每个字符转化的代价是`|s[i] - t[i]|`

思想：算出代价数组，滑动窗口尽可能扩大

```js
var equalSubstring = function (s, t, maxCost) {
  let arr = [];
  for (let i = 0; i < s.length; i++) {
    arr[i] = Math.abs(s.charCodeAt(i) - t.charCodeAt(i));
  }
  let sum = maxCost;
  let left = 0;
  let max = 0;
  for (let i = 0; i < s.length; i++) {
    // console.log(sum, i, left)
    sum -= arr[i];
    while (sum < 0) {
      sum += arr[left++];
    }
    max = Math.max(max, i - left + 1);
  }
  return max;
};
```

## 越长越合法

### 209.长度最小的子数组

思想：滑动窗口，大了就左缩，小了就一直扩大，每次都统计 min

```js
var minSubArrayLen = function (target, nums) {
  let left = 0;
  let sum = 0;
  let len = nums.length - 1;
  let min = 999999;
  for (let i = 0; i < nums.length; i++) {
    sum += nums[i];
    while (sum >= target) {
      min = Math.min(min, i - left + 1);
      sum -= nums[left];
      left++;
    }
  }
  return min === 999999 ? 0 : min;
};
```

# 定长滑窗口

```
套路：
1. 入：元素 x===nums[i] 进入窗口，把x加到元素和s中，把x加到哈希表（统计出现次数）。如果 i<k-1则重复第一步。
2. 更新：如果哈希表的大小>= m,用s更新答案的最大值
3. 出：元素 x== nums[i-k+1] 离开窗口，s减少x，把哈希表中x的出现次数减一。
⚠注意：如果 x 的出现次数变成 0，要从哈希表中删除 x，否则哈希表的大小不正确。
```

### 2841.几乎唯一子数组的最大和

题目：给你一个整数数组 nums 和两个正整数 m 和 k 。

请你返回 nums 中长度为 k 的 几乎唯一 子数组的 最大和 ，如果不存在几乎唯一子数组，请你返回 0 。

如果 nums 的一个子数组有至少 m 个互不相同的元素，我们称它是 几乎唯一 子数组。

子数组指的是一个数组中一段连续 非空 的元素序列。

```
示例1
输入：nums = [2,6,7,3,1,7], m = 3, k = 4
输出：18
解释：总共有 3 个长度为 k = 4 的几乎唯一子数组。分别为 [2, 6, 7, 3] ，[6, 7, 3, 1] 和 [7, 3, 1, 7] 。这些子数组中，和最大的是 [2, 6, 7, 3] ，和为 18 。
```

```js
var maxSum = function (nums, m, k) {
  let sum = 0;
  let map = new Map();
  let len = nums.length;
  let max = 0;
  for (let i = 0; i < len; i++) {
    sum += nums[i];
    let value = map.get(nums[i]);
    map.set(nums[i], value ? value + 1 : 1);
    if (i < k - 1) {
      continue;
    }
    if (map.size >= m) {
      max = Math.max(sum, max);
    }
    sum -= nums[i - k + 1];
    let afterVal = map.get(nums[i - k + 1]);
    afterVal === 1
      ? map.delete(nums[i - k + 1])
      : map.set(nums[i - k + 1], afterVal - 1);
  }
  return max;
};
```

### 2461.长度为 k 子数组中的最大和

类似 `几乎唯一子数组的最大和` 把 `>=m 还为 ==k`

```js
let sum = 0;
let map = new Map();
let len = nums.length;
let max = 0;
for (let i = 0; i < len; i++) {
  sum += nums[i];
  let value = map.get(nums[i]);
  map.set(nums[i], value ? value + 1 : 1);
  if (i < k - 1) {
    continue;
  }
  if (map.size === k) {
    max = Math.max(sum, max);
  }
  sum -= nums[i - k + 1];
  let afterVal = map.get(nums[i - k + 1]);
  afterVal === 1
    ? map.delete(nums[i - k + 1])
    : map.set(nums[i - k + 1], afterVal - 1);
}
return max;
```

### 1052.爱生气的书店老板

题目：有一个书店老板，他的书店开了 n 分钟。每分钟都有一些顾客进入这家商店。给定一个长度为 n 的整数数组 customers ，其中 customers[i] 是在第 i 分钟开始时进入商店的顾客数量，所有这些顾客在第 i 分钟结束后离开。

在某些分钟内，书店老板会生气。 如果书店老板在第 i 分钟生气，那么 grumpy[i] = 1，否则 grumpy[i] = 0。

当书店老板生气时，那一分钟的顾客就会不满意，若老板不生气则顾客是满意的。

书店老板知道一个秘密技巧，能抑制自己的情绪，可以让自己连续 minutes 分钟不生气，但却只能使用一次。

请你返回 这一天营业下来，最多有多少客户能够感到满意 。

```
示例 1：

输入：customers = [1,0,1,2,1,1,7,5], grumpy = [0,1,0,1,0,1,0,1], minutes = 3
输出：16
解释：书店老板在最后 3 分钟保持冷静。
感到满意的最大客户数量 = 1 + 1 + 1 + 1 + 7 + 5 = 16.
示例 2：

输入：customers = [1], grumpy = [0], minutes = 1
输出：1
```

```js
// 思路： 1.分两组计算，不生气 生气
//  先统计不生气，值置为0， 在拿窗口滑动，每一次都统计max（保证不会错过）
var maxSatisfied = function (customers, grumpy, minutes) {
  // 分为两组，生气，和不生气
  // 先统计不生气的
  // 在统计生气的
  let sum = 0;
  let len = grumpy.length;
  let max = 0;
  for (let i = 0; i < len; i++) {
    if (grumpy[i] === 0) {
      sum += customers[i];
      customers[i] = 0;
    }
  }
  for (let i = 0; i < len; i++) {
    sum += customers[i];
    if (i < minutes - 1) {
      continue;
    }
    max = Math.max(max, sum);
    sum -= customers[i - minutes + 1];
  }
  return max;
};
```

### 567.字符串的排列

给你两个子串`s1` `s2`、写一个函数来判断`s2`是否包括`s1`的排列，返回`true`；否则返回`false`

```
输入：s1 = "ab" s2 = "eidbaooo"
输出：true
解释：s2 包含 s1 的排列之一 ("ba").

输入：s1= "ab" s2 = "eidboaoo"
输出：false
```

思想：

- 数组 map 存储`a-z`的频次
- 遍历窗口大小`s1.length`，使用`match(arr1,arr2)`去匹配
- 滑动`s2Map` `左边i右移` `右边 (i+s1.length)右移`

```js
var checkInclusion = function (s1, s2) {
  let s1Map = Array(26).fill(0);
  let s2Map = Array(26).fill(0);
  for (let i = 0; i < s1.length; i++) {
    s1Map[s1.charCodeAt(i) - "a".charCodeAt()]++;
    s2Map[s2.charCodeAt(i) - "a".charCodeAt()]++;
  }
  for (let i = 0; i < s2.length - s1.length; i++) {
    let item = s2[i];
    if (isMatch(s1Map, s2Map)) {
      return true;
    }
    s2Map[s2.charCodeAt(i) - "a".charCodeAt()]--;
    s2Map[s2.charCodeAt(i + s1.length) - "a".charCodeAt()]++;
  }
  return isMatch(s1Map, s2Map);
};
function isMatch(arr1, arr2) {
  for (let i = 0; i < 26; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}
```

### 560.和为 k 的子数组(todo)

注意：滑动窗口的使用是`扩大或缩小整个窗口的单调性是一致`，具体说就是`要么数据全是正数。要么全是负数可以使用`。本题数据是`-1000 <= nums[i] <= 1000`,不可用滑动窗口。

# 二分查找

## 介绍思想

二分是在有序数组中，每次折半查找，以 log n 的时间复杂度快速找到目标元素。

## 解题技巧

> 首先介绍二分查找在`闭区间[]`的写法，再介绍在`开区间( )`,和`半闭半开[ ）`三种的区别
> 如何处理 `>=` `>` `<` `<=` 这四种情况

以一道题为例子

问题：返回有序数组中第一个>=8 的数的位置，如果所有数都<8,返回数组长度

```
输入：nums=[5,7,7,8,8,10] target = 8
输出: 3
```

- 暴力做法：遍历，询问是否`>=8`
- 高效做法：利用数组有序的特征。L，R 指针分别指向询问的左右边界，即闭区间[L,R]。M 指向当前正在询问的数。
- - 如何取 M？取中间，一下子就知道一半数和`target`的大小关系了。
- - 具体询问过程： 如果`M<target`,则更新 L = M+1 ,意味着`L-1以及以前的数`都`<target`; 如果`M>=target`,则 R = M-1 ,意味着`R+1以及以后的数`都`>=target`.
- - 循环不变量原则：以这题为例，**左闭右闭的情况**，那就是 `L-1`都是小于 target 的； `R+1`都是大于 target 的

```js
function lower_bound(nums, target) {
  let left = 0,
    right = nums.length - 1; //[left,right]闭区间
  while (left <= right) {
    // 区间不为空
    let mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  // 最总答案指向L 或者 R+1
  return left;
}

function lower_bound2(nums, target) {
  let left = 0,
    right = nums.length; //[left,right)开区间
  while (left < right) {
    // 区间不为空
    let mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  // 最总答案指向L 或者R
  return L;
}

// 左右都是开区间
function lower_bound3(nums, target) {
  let left = -1;
  right = nums.length; //[left,right)开区间
  while (left + 1 < right) {
    // 区间不为空
    let mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < target) {
      left = mid; // (mid,right)
    } else {
      right = mid; // (left,mid)
    }
  }

  return right;
}
```

### 变形

如果题目不是`>=8` 而可能是`>` `<` `<=`呢？其实是可以转换的

- `>x` 可以转化为 `>=x+1`
- `<x` 可转化为 `(>=x)-1`
- `<=x`,可转化为 `(>x)-1`

### 744. 寻找比目标字母大的最小字母

给你一个字符数组 letters，该数组按非递减顺序排序，以及一个字符 target。letters 里至少有两个不同的字符。返回 letters 中大于 target 的最小的字符。如果不存在这样的字符，则返回 letters 的第一个字符。

```js
var nextGreatestLetter = function (letters, target) {
  const digst = letters.map((v) => v.charCodeAt());
  const targetDig = target.charCodeAt();
  let idx = lower_bound3(digst, targetDig + 1); // >
  if (idx === letters.length || !letters[idx]) {
    return letters[0];
  }
  return letters[idx];
};

function lower_bound3(nums, target) {
  let left = -1;
  right = nums.length; //[left,right)开区间
  while (left + 1 < right) {
    // 区间不为空
    let mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < target) {
      left = mid; // (mid,right)
    } else {
      right = mid; // (left,mid)
    }
  }

  return right;
}
```

### 2529. 正整数和负整数的最大计数

给你一个按 非递减顺序 排列的数组 nums ，返回正整数数目和负整数数目中的最大值。
思路：找到小于 0 的位置，和大于 0 的位置，max 一下长度。

```js
/* 输入：nums = [-2,-1,-1,1,2,3]
输出：3
解释：共有 3 个正整数和 3 个负整数。计数得到的最大值是 3  */

/**
 * @param {number[]} nums
 * @return {number}
 */
var maximumCount = function (nums) {
  //
  let lowIdx = lower_bound3(nums, 0) - 1; // 小于0的位置
  if (lowIdx === nums.length) {
    return nums.length;
  }
  let hightIdx = lower_bound3(nums, 1);

  return Math.max(lowIdx + 1, nums.length - hightIdx);
};
function lower_bound3(nums, target) {
  let left = -1;
  right = nums.length; //[left,right)开区间
  while (left + 1 < right) {
    // 区间不为空
    let mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < target) {
      left = mid; // (mid,right)
    } else {
      right = mid; // (left,mid)
    }
  }
  return right;
}
```

### 2300. 咒语和药水的成功对数

给你两个正整数数组 spells 和 potions ，长度分别为 n 和 m ，其中 spells[i] 表示第 i 个咒语的能量强度，potions[j] 表示第 j 瓶药水的能量强度。同时给你一个整数 success 。一个咒语和药水的能量强度 相乘 如果 大于等于 success ，那么它们视为一对 成功 的组合。请你返回一个长度为 n 的整数数组 pairs，其中 pairs[i] 是能跟第 i 个咒语成功组合的 药水 数目。

```
输入：spells = [5,1,3], potions = [1,2,3,4,5], success = 7
输出：[4,0,3]
解释：
- 第 0 个咒语：5 * [1,2,3,4,5] = [5,10,15,20,25] 。总共 4 个成功组合。
- 第 1 个咒语：1 * [1,2,3,4,5] = [1,2,3,4,5] 。总共 0 个成功组合。
- 第 2 个咒语：3 * [1,2,3,4,5] = [3,6,9,12,15] 。总共 3 个成功组合。
所以返回 [4,0,3] 。
```

```js
var successfulPairs = function (spells, potions, success) {
  let res = [];
  potions.sort((a, b) => a - b);
  // n
  for (let i of spells) {
    const target = Math.ceil(success / i);
    let idx = lower_bound3(potions, target); // >= success的第一个位置
    res.push(potions.length - idx);
  }
  return res;
};

function lower_bound3(nums, target) {
  let left = -1;
  right = nums.length; //[left,right)开区间
  while (left + 1 < right) {
    // 区间不为空
    let mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < target) {
      left = mid; // (mid,right)
    } else {
      right = mid; // (left,mid)
    }
  }
  return right;
}
```

### 1385. 两个数组间的距离值

题意:给一个数组`arr1`,另一个数组`arr2`，用`arr1`的元素减去`arr2`的每个元素，满足差值的绝对值大于给定的`d`，则统计加 1。所以最大统计值可能为`arr1.length`

```
输入：arr1 = [4,5,8], arr2 = [10,9,1,8], d = 2
输出：2
解释：
对于 arr1[0]=4 我们有：
|4-10|=6 > d=2
|4-9|=5 > d=2
|4-1|=3 > d=2
|4-8|=4 > d=2
所以 arr1[0]=4 符合距离要求

对于 arr1[1]=5 我们有：
|5-10|=5 > d=2
|5-9|=4 > d=2
|5-1|=4 > d=2
|5-8|=3 > d=2
所以 arr1[1]=5 也符合距离要求

对于 arr1[2]=8 我们有：
|8-10|=2 <= d=2
|8-9|=1 <= d=2
|8-1|=7 > d=2
|8-8|=0 <= d=2
存在距离小于等于 2 的情况，不符合距离要求

故而只有 arr1[0]=4 和 arr1[1]=5 两个符合距离要求，距离值为 2
```

思路：每个 arr1 的元素在排序后的 arr2 中二分查找，看最接近的元素是否能满足。注意`idx = 0` `idx = arr2.length`的情况

```js
var findTheDistanceValue = function (arr1, arr2, d) {
  arr2.sort((a, b) => a - b);
  function check(arr2, item, d) {
    // 查看有没有很贴近的（）
    let closeIdx = lower_bound3(arr2, item); // 很接近的  >=item的
    let colseIdx2 = closeIdx - 1;
    //console.log('closeIdx:' + closeIdx);
    if (closeIdx === arr2.length) {
      return Math.abs(item - arr2[closeIdx - 1]) > d;
    }
    if (closeIdx === 0) {
      return Math.abs(item - arr2[closeIdx]) > d;
    }
    return (
      Math.abs(item - arr2[closeIdx]) > d &&
      Math.abs(item - arr2[colseIdx2]) > d
    );
  }
  // 不存在 <=d， 也就是所有大于d
  let count = 0;
  for (let i = 0; i < arr1.length; i++) {
    if (check(arr2, arr1[i], d)) {
      //console.log(arr1[i], 'd:' + d);
      count++;
    }
  }
  return count;
};

function lower_bound3(nums, target) {
  let left = -1;
  right = nums.length; //[left,right)开区间
  while (left + 1 < right) {
    // 区间不为空
    let mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < target) {
      left = mid; // (mid,right)
    } else {
      right = mid; // (left,mid)
    }
  }
  return right;
}
```

### 1170. 比较字符串最小字母出现频次

给你第一个数组形如`queries = ["cbd"]`，需要统计最小字典序的频率。 再给你另一个数组形如`words = ["zaaaz"]`,看`queries`每个元素最小字典序的频率 小于`word`中所有的个数。

```
f(s)定义为 字符串中最小字典序的频率
输入：queries = ["bbb","cc"], words = ["a","aa","aaa","aaaa"]
输出：[1,2]
解释：第一个查询 f("bbb") < f("aaaa")，第二个查询 f("aaa") 和 f("aaaa") 都 > f("cc")。
```

```js
var numSmallerByFrequency = function (queries, words) {
  let ans = [];
  let wordDist = words.map((v) => getCount(v));
  let queriesDist = queries.map((v) => getCount(v));
  wordDist.sort((a, b) => a - b);
  // console.log(queriesDist);
  // console.log(wordDist);
  for (let i = 0; i < queriesDist.length; i++) {
    let count = queriesDist[i];
    // 二分看他的count排在哪，就能快速知道他比几个大，比几个小了
    let idx = lower_bound(wordDist, count + 1); // >=count
    // console.log({ idx }, { count });
    ans.push(wordDist.length - idx);
  }
  // console.log(ans);
  return ans;
};
function getCount(str) {
  let preCode = str[0];
  let count = 1;
  for (let i = 1; i < str.length; i++) {
    if (str[i].charCodeAt() < preCode.charCodeAt()) {
      preCode = str[i];
      count = 1;
    } else if (str[i].charCodeAt() === preCode.charCodeAt()) {
      count++;
    }
  }
  return count;
}
function lower_bound(nums, target) {
  let left = 0,
    right = nums.length - 1; //[left,right]闭区间
  while (left <= right) {
    // 区间不为空
    let mid = Math.floor((left + right) / 2);
    if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  // 最总答案指向L 或者 R+1
  return left;
}
```

### 3488. 距离最小相等元素查询

题意：给出一个环形数组`nums`,里面可能会出现重复元素，再给出一个`queries`,每个元素调用在`nums`的 index，遍历每个`queries`找到对应在`nums`中的位置，然后看，和他数值相同的 idx 最近的距离是多少

```
输入： nums = [1,3,1,4,1,3,2], queries = [0,3,5]

输出： [2,-1,3]

解释：

查询 0：下标 queries[0] = 0 处的元素为 nums[0] = 1 。最近的相同值下标为 2，距离为 2。
查询 1：下标 queries[1] = 3 处的元素为 nums[3] = 4 。不存在其他包含值 4 的下标，因此结果为 -1。
查询 2：下标 queries[2] = 5 处的元素为 nums[5] = 3 。最近的相同值下标为 1，距离为 3（沿着循环路径：5 -> 6 -> 0 -> 1）。
```

```js
var solveQueries = function (nums, queries) {
  let pos = {};
  let ans = [];
  nums.forEach((i, idx) => {
    if (pos[i]) {
      pos[i].push(idx);
    } else {
      pos[i] = [idx];
    }
  });
  // console.log(pos)
  for (let i = 0; i < queries.length; i++) {
    let max = Number.MAX_VALUE;
    let numsIdx = queries[i];
    let value = nums[numsIdx];
    let list = pos[value];
    if (!list || list.length === 1) {
      ans.push(-1);
      continue;
    }
    let idx = lower_bound(list, numsIdx); //找到>=的位置
    let pre = (idx - 1 + list.length) % list.length;
    let nxt = (idx + 1 + list.length) % list.length;

    //console.log({ numsIdx }, { value }, { idx }, { pre }, { nxt })

    let len1 = list[idx] - list[pre];
    let len2 = nums.length - (list[idx] - list[pre]);
    if (pre < idx) {
      max = Math.min(len1, len2);
    } else {
      max = nums.length - (list[pre] - list[idx]);
    }
    let len3 = list[nxt] - list[idx];
    let len4 = nums.length - (list[nxt] - list[idx]);
    if (nxt > idx) {
      max = Math.min(len3, len4, max);
    } else {
      max = Math.min(nums.length - (list[idx] - list[nxt]), max);
    }
    ans.push(max);
  }
  //console.log(ans)
  return ans;
};
function lower_bound(nums, target) {
  let left = 0,
    right = nums.length - 1; //[left,right]闭区间
  while (left <= right) {
    // 区间不为空
    let mid = Math.floor((left + right) / 2);
    if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  // 最总答案指向L 或者 R+1
  return left;
}
```

### 2563. 统计公平数对的数目

题意：给一个数组`nums`，数组里选两个元素成一组，两元素和在给出的`lower`和`high`之间

思想：二分边界

```js
var countFairPairs = function (nums, lower, upper) {
  nums.sort((a, b) => a - b);
  let ans = 0;
  for (let j = 0; j < nums.length; j++) {
    // 注意要在 [0, j-1] 中二分，因为题目要求两个下标 i < j
    const r = lower_bound3(nums, j, upper - nums[j] + 1); // 这个值是不取的
    const l = lower_bound3(nums, j, lower - nums[j]);
    ans += r - l;
  }
  return ans;
};
```

### 2070.每一个查询的最大美丽值

题意：给定一个二维数组，其中元素`item[i]=[price,beauty]`。在给定另一个数组`queries`，`queries[i]`表示 prices 的大小。要求查询每一个`queries[i]`看能每一个的美丽值`beauty`是多少。

```
输入：items = [[1,2],[3,2],[2,4],[5,6],[3,5]], queries = [1,2,3,4,5,6]
输出：[2,4,5,5,6,6]
解释：
- queries[0]=1 ，[1,2] 是唯一价格 <= 1 的物品。所以这个查询的答案为 2 。
- queries[1]=2 ，符合条件的物品有 [1,2] 和 [2,4] 。
  它们中的最大美丽值为 4 。
- queries[2]=3 和 queries[3]=4 ，符合条件的物品都为 [1,2] ，[3,2] ，[2,4] 和 [3,5] 。
  它们中的最大美丽值为 5 。
- queries[4]=5 和 queries[5]=6 ，所有物品都符合条件。
  所以，答案为所有物品中的最大美丽值，为 6 。
```

```js
// 排序 + 先更新美丽值
var maximumBeauty = function (items, queries) {
  items.sort((a, b) => {
    if (a[0] === b[0]) {
      return a[1] - b[1];
    }
    return a[0] - b[0];
  });
  let max = 0;
  for (let i = 0; i < items.length; i++) {
    let ele = items[i];
    if (ele[1] > max) {
      max = ele[1];
    } else {
      ele[1] = max;
    }
  }

  // console.log(items)
  let ans = [];
  for (let i = 0; i < queries.length; i++) {
    let max = 0;
    let ele = queries[i];
    let idx = lower_bound3(items, ele + 1) - 1;
    // 拿到下标还要在找一下，那个的美丽值最大
    // console.log({ i }, { idx }, { ele })
    ans[i] = items[idx] ? items[idx][1] : 0;
  }
  return ans;
};

function lower_bound3(nums, target) {
  let left = -1;
  right = nums.length; //[left,right)开区间
  while (left + 1 < right) {
    // 区间不为空
    let mid = left + Math.floor((right - left) / 2);
    if (nums[mid][0] < target) {
      left = mid; // (mid,right)
    } else {
      right = mid; // (left,mid)
    }
  }

  return right;
}
```

### 658. 找到 K 个最接近的元素

题意：给定一个排好序的数组`arr`,两个整数`k` 和`x`， 找到 k 个距离 x 最近的元素，如果左右两个元素距离 x 一样近，取左侧。最终要升序

```
输入：arr = [1,2,3,4,5], k = 4, x = 3
输出：[1,2,3,4]
```

```js
// 二分，定index位置，左右指针找到满足的就行
var findClosestElements = function (arr, k, x) {
  let idx = lower_bound3(arr, x);
  if (idx === arr.length) {
    return arr.slice(arr.length - k, arr.length);
  }
  if (arr[idx] !== x) {
    idx = Math.abs(x - arr[idx - 1]) <= Math.abs(arr[idx] - x) ? idx - 1 : idx;
  }
  //console.log({ idx })
  let left = idx,
    right = idx + 1;
  let r_arr = [];
  let l_arr = [];
  while (k > 0) {
    if (left < 0 || Math.abs(arr[right] - x) < Math.abs(arr[left] - x)) {
      r_arr.push(arr[right]);
      right++;
    } else {
      l_arr.unshift(arr[left]);
      left--;
    }
    k--;
  }
  // console.log(l_arr)
  return [...l_arr, ...r_arr];
};
```

### LCP 08.剧情触发时间

题意：三个维度的值，用数组的三个元素表示`[C,R,H]` 0 天初始值`[0,0,0]` 随着游戏进程的进行，每一天玩家的三种属性值会增加。我们用一个二维数组 `increase` 来表示每天的增加情况。这个二维数组的每个元素是一个长度为 3 的一维数组，例如 [[1,2,1],[3,4,2]] 表示第一天三种属性分别增加 1,2,1 而第二天分别增加 3,4,2。 所有剧情触发条件也用另一个二维数组`requirements`。 对剧情触发的定义是：`requirements[0] requirements[1] requirements[2]`，对应的当天的属性值满足`C>=requirements[0]` `R>=requirements[1]` `H>requirements[2]` ，则为触发剧情。结果需要用数组存储。对应 requiement 对应哪样才满足触发剧情。如果都为满足则记录`-1`

```js
// 层级统计三个维度，C维度二分，满足了就继续R维度二分（起始点为C二分时确认的startIdx),对应H（起始点为R二分时确认的startIdx)同理。
var getTriggerTime = function (increase, requirements) {
  let atotal = 0,
    btotal = 0,
    ctotal = 0;
  let arr = increase.map(([a, b, c]) => {
    atotal += a;
    btotal += b;
    ctotal += c;
    return [atotal, btotal, ctotal];
  });
  let ans = [];
  for (let i = 0; i < requirements.length; i++) {
    let ele = requirements[i];
    if (ele[0] === ele[1] && ele[1] === ele[2] && ele[0] === 0) {
      ans.push(0);
      continue;
    }
    let aIdx = lower_bound3(arr, ele[0], 0, 0, arr.length - 1);
    // console.log({ aIdx }, arr[aIdx]?.[0] < ele[0])
    if (aIdx === arr.length || (aIdx === 0 && arr[aIdx][0] < ele[0])) {
      ans.push(-1);
      continue;
    }
    let bIdx = lower_bound3(arr, ele[1], 1, aIdx, arr.length - 1);
    // console.log({ bIdx }, arr[bIdx]?.[1] < ele[1])
    if (bIdx === arr.length || (aIdx === bIdx && arr[bIdx]?.[1] < ele[1])) {
      ans.push(-1);
      continue;
    }

    let cIdx = lower_bound3(arr, ele[2], 2, bIdx, arr.length - 1);
    // console.log({ cIdx }, arr[cIdx]?.[2] < ele[2])
    if (cIdx === arr.length || (cIdx === bIdx && arr[cIdx]?.[2] < ele[2])) {
      ans.push(-1);
      continue;
    }
    ans.push(cIdx + 1);
  }
  return ans;
};
```

# 二分答案

循环不变量：对于求最小，开区间的写法，为什么最终返回`right`。在初始化（循环之前）、循环中、循环结束后，都时时刻刻保证`check(right)===true`和`check(left)===false`，这就是循环不变量。根据循环不变量，循环结束时`left+1===right`，那么`right`就是最小的满足要求的数（因为再-1 就不满足要求了）。所以答案是`right`

## 求最小

```js
// 模版
function low_bound(nums) {
  let left = -1,
    right = nums.length; // 循环不变量（ check(right)===true)
  while (left + 1 < right) {
    let mid = Math.floor((left + right) / 2);
    if (check(mid)) {
      right = mid;
    } else {
      left = mid;
    }
  }
  return right; // 答案是right或者left+1
}
```

### 1283. 使结果不超过阈值的最小除数

题意：给定一个数组，和一个阈值，找一个正整数`M`作为除数，让数组除以这个正整数，向上取整，并加和，使得最终结果小于等于这个阈值。 找这个正整数最小是多少。

具有单调性，`M`越大，加和结果记忆越小，具有单调性。可考虑使用二分答案。
```js
//  找到了继续right往左到。
// 给定阈值范围  
var smallestDivisor = function (nums, threshold) {
  function check(data) {
    // 二分答案，
    let sum = 0;
    for (let v of nums) {
      sum += Math.ceil(v / data);
      if (sum > threshold) {
        return false;
      }
    }
    return true;
  }
  let target = Math.max.apply(null, nums);
  function low_bound(nums, threshold) {
    // 最小 right为true
    let left = -1,
      right = threshold + 1;
    while (left + 1 < right) {
      let mid = Math.floor((right + left) / 2);
      if (check(mid)) {
        right = mid;
      } else left = mid;
    }
    return right;
  }
  let i = low_bound(nums, target);
  //console.log({ i })
  return i;
};
```

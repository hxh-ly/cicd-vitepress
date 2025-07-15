# 二叉树

## 递归本质

![alt text](img/image01.png)

## 104.二叉树的最大深度

https://leetcode.cn/problems/maximum-depth-of-binary-tree/

```js
var maxDepth = function (root) {
  // 思考整棵树和左右的关系
  // 深度= max(left,right)+1
  // 归是 节点不存在的时候
  let ans = 0;
  var dfs = function (root, cnt) {
    if (!root) {
      return;
    }
    cnt++;
    ans = Math.max(ans, cnt);
    dfs(root.left, cnt);
    dfs(root.right, cnt);
  };
  dfs(root, 0);
  return ans;
};
```

## 100.相同的树

https://leetcode.cn/problems/same-tree/

```js
/**
 * Definition for a binary tree node.
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */
/**
 * @param {TreeNode} p
 * @param {TreeNode} q
 * @return {boolean}
 */
var isSameTree = function (p, q) {
  // 原文题：树是否相同
  // 子问题：树大的节点是否相同
  // 归 -> 不相同或者相同的时候返回
  if (!p && !q) {
    return true;
  }
  if (!p || !q) {
    return false;
  }
  if (p.val !== q.val) {
    return false;
  }
  return isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
};
```

## 101.对称二叉树

https://leetcode.cn/problems/symmetric-tree/description/

```js
/**
 * Definition for a binary tree node.
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */
/**
 * @param {TreeNode} root
 * @return {boolean}
 */
var isSymmetric = function (root) {
  /* 
    原问题：树是否对称
    子问题：左右子树是否对称
    递：关系为 左子左 右子右。左子右 右子左
    归：具体节点值是否相等
     */
  var isSame = function (left, right) {
    if (!left && !right) {
      return true;
    }
    if (!left || !right) {
      return false;
    }
    if (left.val !== right.val) {
      return false;
    }
    return isSame(left.left, right.right) && isSame(left.right, right.left);
  };

  return isSame(root.left, root.right);
};
```

## 110.平衡二叉树

https://leetcode.cn/problems/balanced-binary-tree/description/

```js
/**
 * Definition for a binary tree node.
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */
/**
 * @param {TreeNode} root
 * @return {boolean}
 */
var isBalanced = function (root) {
  /* 
    原问题：是不是整树是不是平衡二叉树
    子问题：左右子树是平衡二叉树
     递： 
     归：高度差大于1或者都不存在
     */
  if (!root) {
    return true;
  }
  let left_deepth = maxDepth(root.left);
  let right_deepth = maxDepth(root.right);
  if (Math.abs(left_deepth - right_deepth) > 1) {
    return false;
  }
  return isBalanced(root.left) && isBalanced(root.right);
};
var maxDepth = function (root) {
  if (!root) {
    return 0;
  }
  let left_deepth = maxDepth(root.left);
  let right_deepth = maxDepth(root.right);
  return Math.max(left_deepth, right_deepth) + 1;
};
```

way2:把负数利用起来，返回负一就是不平衡的

```js
var isBalanced = function (root) {
  /* 
    原问题：是不是整树是不是平衡二叉树
    子问题：左右子树是平衡二叉树
     递： 往下探深度
     归：-1 代表不平衡
     */
  function getHeight(root) {
    if (!root) {
      return 0;
    }
    let l = getHeight(root.left);
    if (l === -1) {
      return -1;
    }
    let r = getHeight(root.right);
    if (r === -1 || Math.abs(l - r) > 1) {
      return -1;
    }
    return Math.max(l, r) + 1;
  }
  return getHeight(root) !== -1;
};
```

解释：算出左右子树高度，做差就知道是不是平衡二叉树了

## 199.二叉树的右视图

```js
/* 
原问题：右侧能看的节点值
子问题：右子树能看到的节点值，做子树能看到的节点值
递：
归：节点为未空，或者当前深度和答案长度一致
*/
var rightSideView = function (root) {
  let ans = [];
  var dfs = function (root, deepth) {
    if (!root) {
      return;
    }
    if (deepth === ans.length) {
      ans.push(root.val);
    }
    dfs(root.right, deepth + 1);
    dfs(root.left, deepth + 1);
  };
  dfs(root, 0);
  return ans;
};
```

解释：每一层只能保留一个，初始化根节点为 0 层， 这一层还没放，可以放到答案里，
然后从右子树开始，因为要先看到右视图。

way2 层序遍历

```js
var rightSideView = function (root) {
  let stack = [];
  if (root) {
    stack.push(root);
  }
  let ans = [];
  while (stack.length) {
    ans.push(stack[stack.length - 1]?.val);
    let n = stack.length;
    for (let i = 0; i < n; i++) {
      let item = stack.shift();
      if (item?.left) {
        stack.push(item.left);
      }
      if (item?.right) {
        stack.push(item.right);
      }
    }
  }
  return ans;
};
```

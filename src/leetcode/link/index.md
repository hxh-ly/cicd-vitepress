# 链表

## lc.206.反转链表

原题：https://leetcode.cn/problems/reverse-linked-list/description/

```js
/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
/**
 * @param {ListNode} head
 * @return {ListNode}
 */
var reverseList = function (head) {
  let pre = null;
  let cur = head;
  while (cur) {
    let nxt = cur.next;
    cur.next = pre;
    pre = cur;
    cur = nxt;
  }
  return pre;
};
```

解释：
需要一个 pre 指针保存 cur 指针上一个节点，同时需要个 next 指针保存 cur.next 的节点，
在这之后 cur 的下一个直线前置节点，实现反转
最后先更新 pre，再更新 cur。
最终 cur 为空，返回 pre
![alt text](./img/link_image01.png)

## lc.92.反转链表 II

原题：https://leetcode.cn/problems/reverse-linked-list-ii/description/

```js
/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
/**
 * @param {ListNode} head
 * @param {number} left
 * @param {number} right
 * @return {ListNode}
 */
var reverseBetween = function (head, left, right) {
  let dummy = new ListNode(); //先保存最初位置
  dummy.next = head;
  let p0 = dummy;
  // 考虑left可能就是head，引入p0

  // p0的位置在于初始left的上一个节点
  Array(left - 1)
    .fill(0)
    .forEach(() => {
      p0 = p0.next;
    });
  // 这部分和反转列表一致
  let pre = null;
  let cur = left;
  Array(right - left + 1)
    .fill(0)
    .forEach(() => {
      let nxt = cur.next;
      cur.next = pre;
      pre = cur;
      cur = nxt;
    });
  // 重新链接
  p0.next.next = cur; // 已有的要先绑
  p0.next = pre; // 如果先绑定这个，那po.next.next就变了

  return dummy.next; // 一开始保留的开始head，
};
```

解释：
这里要考虑
第一种情况，反转部分，所以要保留 dummy 一开始的指向。
第二种情况，就是 left 就是 head 的时候
细节参考代码注释

## lc.25. K 个一组翻转链表

原题：https://leetcode.cn/problems/reverse-nodes-in-k-group/description/
细节：每 k 个一组翻转，小于 k 就不反转

```js
/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
/**
 * @param {ListNode} head
 * @param {number} k
 * @return {ListNode}
 */
var reverseKGroup = function (head, k) {
  let dummy = new ListNode();
  dummy.next = head;
  let p0 = dummy;

//  先记录总个数
  let n = 0;
  let coutCur = head;
  while (coutCur) {
    n++;
    coutCur = coutCur.next;
  }
  let pre = null;
  let cur = head;

  // 多少组
  while (n >= k) {
    pre = null;
    n -= k;
    let count = k;
    // 每k个为一组翻转
    while (count > 0) {
      count--;
      let nxt = cur.next;
      cur.next = pre;
      pre = cur;
      cur = nxt;
    }
    // !!临时变量，这一组结束后，p0要移动到这一组翻转后，结尾的位置，循环开始
    let tempP0 = p0.next;
    p0.next.next = cur;
    p0.next = pre;
    p0 = tempP0;
  }
  return dummy.next;
};
```

解释：与lc.92的区别在于，每k个为一组进行翻转。
也就是每做完一组，需要重新更新 p0到这一组翻转后结尾的位置 pre=null
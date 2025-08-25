/* var subarraySum = function (nums, k) {
  let left = 0;
  let right = 0;
  let len = nums.length;
  let sums = 0;
  let count = 0;
  while (right < len) {
    sums += nums[right];
    while (sums >= k) {
      if (sums === k) {
        count++;
      }
      sums -= nums[left++];
    }
    right++;
  }
  console.log(count);
  return count;
};
subarraySum([1, 1, 1], 2);
 */

var equalSubstring = function (s, t, maxCost) {
  let arr = [];
  for (let i = 0; i < s.length; i++) {
    arr[i] = Math.abs(s.charCodeAt(i) - t.charCodeAt(i));
  }
  let sum = maxCost;
  let left = 0;
  let max = 0;
  for (let i = 0; i < s.length; i++) {
    console.log("当前i:" + i);
    console.log("当前sum:" + sum);
    if (sum >= arr[i]) {
      sum -= arr[i];
      max = Math.max(max, i - left + 1);
    } else {
      while (sum < arr[i]) {
        sum += arr[left++];
      }
      left++;
      console.log("当前left:" + left);
    }
  }
  return max;
};
equalSubstring("abcd", "cdef", 3);

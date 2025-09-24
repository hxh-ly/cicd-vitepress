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
const queries = ["cbd"];
words = ["zaaaz"];
// numSmallerByFrequency(queries, words);
const binarySearch = (nums, right, target) => {
  let left = 0;
  while (left <= right) {
    const mid = (left + right) >> 1;
    // 蓝区左边界
    if (nums[mid] <= target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return left;
};
console.log(   binarySearch([-1, 0], 0, 2) ) // 1-（-1）   找小于等于2的位置， // 1
console.log(   binarySearch([-1, 0], 0, 1)) // 1-（-1）-1  找小于等于2的位置， // 1
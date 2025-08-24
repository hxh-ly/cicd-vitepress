## 岛屿数量

题目：给你一个由 '1'（陆地）和 '0'（水）组成的的二维网格，请你计算网格中岛屿的数量。

岛屿总是被水包围，并且每座岛屿只能由水平方向和/或竖直方向上相邻的陆地连接形成。

此外，你可以假设该网格的四条边均被水包围。

```
输入：grid = [
  ["1","1","1","1","0"],
  ["1","1","0","1","0"],
  ["1","1","0","0","0"],
  ["0","0","0","0","0"]
]
输出：1
```

思想：`dfs`上下左右去占领

```js
/**
 * @param {character[][]} grid
 * @return {number}
 */
var numIslands = function (grid) {
  let count = 0;
  let col = grid.length;
  let row = grid[0].length;
  function dfs(grid, i, j) {
    if (i < 0 || i >= col || j < 0 || j >= row) {
      return;
    }
    if (grid[i][j] == 1) {
      grid[i][j] = "0";
      dfs(grid, i + 1, j);
      dfs(grid, i, j + 1);
      dfs(grid, i - 1, j);
      dfs(grid, i, j - 1);
    }
  }
  for (let i = 0; i < col; i++) {
    for (let j = 0; j < row; j++) {
      if (grid[i][j] == 1) {
        dfs(grid, i, j);
        count++;
      }
    }
  }
  return count;
};
```

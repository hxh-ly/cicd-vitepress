## 配置eslint+prettier最佳实践 eslint + prettier + husky + lint-staged

如何统一代码风格，规范提交呢？ 推荐使用前端规范全家桶 ESLint + Prettier + husky + lint-staged。

1.eslint (https://github.com/eslint/eslint) JavaScript 代码检测工具，检测并提示错误或警告信息

2.stylelint (https://github.com/stylelint/stylelint) css 样式格式化工具

3.prettier (https://github.com/prettier/prettier) 代码自动化格式化工具，更好的代码风格效果

3.husky (https://github.com/typicode/husky) Git hooks 工具, 可以在执行 git 命令时，执行自定义的脚本程序

4.lint-staged (https://github.com/lint-staged/lint-staged) 对暂存区 (git add) 文件执行脚本 检测 校验

5.Commitizen(https://github.com/commitizen-tools/commitizen) 检测 git commit 内容是否符合定义的规范

5.eslint-config-prettier (https://github.com/prettier/eslint-config-prettier/) 解决 eslint 和 prettier 冲突


### eslint的style guide

1.官方推荐规则 extends:'eslint:recommended'
2.Airbnb JavaScript Style Guide:最严格的风格之一
配置方式
`npm i eslint-config-airbnb -D`

```js
extends:'airbnb-base' // 包含react
extends:'airbnb' // 不包含react
```

3.Google Javascript Style Guide
配置方式
`npm i eslint-config-google -D`

```js
extends:'google'
```

4.Standard JS
零配置
配置方式
`npm i eslint-config-standard -D`

```js
extends:'standard'
```

5.框架专用风格
`npm i @typescript-eslint/eslint-plugin -D`

```js
extends:[
  'eslint:recommended',
  'plugin:@typescript-eslint/recommended'
]
```

6.自定义

```js
extends:['airbnb-base','plugin:prettier/recommended'],
rules:{
  'prettier/prettier':'error'
}
```

### eslint使用相关

```
npm install eslint
npm init @eslint/config //对话选择
```

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"]
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: { globals: globals.browser }
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    rules: {
      "prettier/prettier": "error", // add 将prettier 错误视为 ESlint错误
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  }
]);
```

### husky

husky是一个git钩子（git hook）工具，它可以让你在git事件发生时执行脚本，进行代码格式化，测试等操作。

- `pre-commit` 在执行Git commit命令之前触发，用于在提交代码前进行代码检查，格式化、测试等操作。
- `commit-msg`: 在提交信息被创建后，单提交操作尚未完成之前触发吗，用于校验提交消息的格式和内容。
- `pre-push`：在执行git push命令之前触发，用于在推送代码前进行额外检查、测试等操作。
  安装
  `注意！需要在.git文件同目录下安装husky，否则无法识别环境导致安装失败` 1.`npm install husky -D` 2.使 `git hooks`生效
  `npx husky insatll` 3.在package.json里面创建执行脚本
  `npm pkg set scripts.prepare="husky install"`

在./husky下创建挂钩
`pre-commit`
添加shell脚本

```shell
#!/usr/bin/env sh
echo "Hello, World!!!!"
node -v
npm run lint:lint-staged
```

配置lint:lint-staged命令

```json
 "lint:lint-staged": "lint-staged"
```

### lint-staged

作用：lint-staged可以让你在Git暂存区域中的文件运行脚本，通常用与在提交前对代码进行格式化，静态见擦好等操作。
使用方式：你可以在项目中使用lint-staged配合husky钩子来执行针对暂存文件的脚本
`npm i lint-staged -D`
package.json添加

```js
{
  "lint-staged": {
    // src/**/*.{js,jsx,ts,tsx} 校验暂存区、指定目录下的文件类型
    // 校验命令，执行 eslint 、prettier
    "src/**/*.{js,jsx,ts,tsx}": [
      "prettier --write",
      "eslint --fix"
    ]
  }
}
```
解释：
husky是门卫，控制合适执行脚本。
lint-staged是脚本的“优化器”，确保只处理本次提交的文件。

### Stylelint

`npm i stylelint stylelint-config-standard-scss`
项目根目录创建 .stylelintrc.json

```js
{
  'extends':"stylelint-config-standard-scss"
}
```

让Stylelint处理项目的所有SCSS文件
`npx stylelint "**/*.scss"`
package.json添加命令修复

```js
"style":"stylelint \"src/**/*.(vue|scss|css)\" --fix"
```

### Prettier

`npm install prettier -D`

```js
// .prettierrc.js
module.exports = {
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  jsxSingleQuote: true,
  jsxBracketSameLine: true,
  trailingComma: "none",
  bracketSpacing: true
};
```

加上.prettierignore

```
#ignore
node_modules
.DS_Store
yarn*
*-lock*
dist*
public/
```

相关命令
`npx prettier --write src/`

### Commitizen

是一个命令行工具，用以一致的方式编写规范的提交信息。
cz-conventional-changelog是一个Commitizen的一个适配器，它实现了约定式提交规范的提交消息。

```
npm install --save-dev commitizen cz-conventional-changelog
```

配置package.json

```js
  "scripts": {
  "commit": "git-cz" //允许你使用交互的方式提交
  }
  "config":{
    "commitizen":{
      "path":"cz-conventional-changelog"
    }
  }
```

### 解决eslint和prettier冲突

有时，ESlint的规则和Prettier的规则可能存在冲突，导致代码格式化不一致。使用eslint-config-prettier可以关闭冲突规则
`npm i eslint-config-prettier eslint-plugin-prettier -D`

- eslint-config-prettier 关闭冲突规则
- eslint-plugin-prettier:允许eslint使用prettier格式化代码的能力

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginPrettier from "eslint-plugin-prettier"; // add
import { defineConfig } from "eslint/config";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"; // add
export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js, prettier: pluginPrettier }, // add
    extends: ["js/recommended"],
    rules: {
      "prettier/prettier": "error" // add 将prettier 错误视为 ESlint错误
    }
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: { globals: globals.browser }
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  eslintPluginPrettierRecommended, // add
  {
    rules: {
      "prettier/prettier": "error", // add 将prettier 错误视为 ESlint错误
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  }
]);
```

### 总结

eslint是“警察”，关注逻辑错误和潜在问题。（变量定义，不可达代码，比较赋值）

prettier是“美容师”，提供统一排版风格。（单引号，缩进）。固执哲学是代码风格不应该有争议，仅提供少数配置选项。

最佳实践：两者结合使用，eslint复杂逻辑检查，prettier复杂格式统一，通过工具链执行。



[项目地址](https://github.com/hxh-ly/webpack-use)
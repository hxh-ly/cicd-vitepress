## 回顾 webpack 配置

熟悉一下 webpack 的配置 1.配置 mode

```js
module.exports = {
  mode: "production"
};
```

2.配置 entry

```js
module.exports = {
  mode: "production",
  entry: {
    aa: "./src/a.js"
  }
};
```

3.配置 output

```js
module.exports = {
  mode: "production",
  entry: {
    aa: "./src/a.js"
  },
  output: {
    filename: "dist.js"
  }
};
```

4.配置打包命令

```json
{
  "scripts": {
    "build": "webpack"
  }
}
```

5.使用 loader
使用 sass-loader `npm i sass sass-loader css-loader style-loader -D`
使用 babel-loader `npm i babel-loader @babel/core @babel/preset-env -D`
使用 typescirpt `npm i typescript @babel/preset-typescript -D`
使用 jsx 和 tsx `npm i @babel/preset-react -D`
使用图片 `webpack 自带file-loader和url-loader`
使用字体资源 `webpack 自带file-loader`

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.scss/,
        use: ["style-loader", "css-loader", "sass-loader"]
      },
      {
        test: /(\.m?js$|\.ts)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-typescript"]
          }
        }
      },
      {
        test: /\.(jpe?g|png|gif|webp)$/,
        type: "asset"
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/,
        type: "asset/resource",
        generator: {
          filename: "resources/[hash:10][ext][query]"
        }
      }
    ]
  }
};
```

package.json 配置兼容性

```json
 "browserslist": [
  "defaults", //默认
  "ie <= 11", //ie版本低于11
  "last 2 versions", //至少存在两个版本
  "> 1%", //市场占有率大于1%
  "iOS 7"
]
```

配置后缀解析

```js
{
  resolve:{
    alias:{
      $css:path.resolve(__dirname,'./src/css');
    },
    extensions:['.js','.ts','.jsx','tsx']
  }
}
```

plugin:
html-webpack-plugin `npm i html-webpack-plugin -D `

```js
const HtmlWebpackPlugin = require('html-webpack-plugin')
module.exports = {
    plugins:[
      new HtmlWebpackPlugin({
        template:'./index.html'
      })
    ]
  }
};
```

dev 开发`npm i webpack-dev-server -D`

```json
{
  "scripts": {
    "dev": "webpack serve"
  }
}
```

搭建 react 环境 `npm i react react-dom -S`
`npm i @types/react @types/react-dom -D`

```tsx
// index.tsx
createRoot(document.getElementById("root")).render(<App />);
```

配置 tsx 自动引入 React

```js
{
  rules:[{
   test://,
   use:'babel-loader',
   options:{
    presets:['@babel/preset-env',['@babel/preset-react',{runtime:'automatic'}],'@babel/preset-react']
   }
  }]
}
```

[项目地址](https://github.com/hxh-ly/webpack-use)
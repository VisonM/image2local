## why i2l?

> 将 cdn 的图片，下载到本地。以满足图片域名为当前访问域名

## 原理

先`prettier`格式化，再用`正则替换`匹配到的字符。

## 说明

- 在代码中注视掉的模块，我们无法格式化，这会导致一些匹配上出现的错误，和冗余的资源下载，但是基于正则的模式下，这很难避免。
- 即使提供了全量一次性替换，仍然建议少量多次,具体请查看`i2l -h`
- 下载限制同时 10 条，会重试
- 即使项目中已经把静态图片转为本地，但是服务端下发的图片，仍然是无法处理的，所以服务端下发的图片，建议过一层裁剪服务，以达到图片域名为当前访问域目的。
- 无依赖追踪，所以可能存在有复杂关联场景时，漏处理，需手动替换。

## 可转换的格式

### .js | .jsx

```bash
  src = "***"
  backgroundImage= "url(***)"
  "***" # 普通变量
```

### .less

```less
url('xxx')
```

## 使用

### 安装

```bash
npm i -g image2local

// or

npx image2local
```

### 指令

#### all

- 说明：转换整个项目
- 输入：马甲包名，无可不传，用`','`隔开
- 可选参数：`-l` | `--loglevel`
  - `error`
  - `warn`
  - `info`
  - `debug`
- 示例：

```bash
i2l all "windmoon,taoYu,sweetlove,finelove,peach,sweetface" --loglevel=error
```

#### pkg

- 说明：转换一个马甲包
- 输入：路径
- 可选参数：`-l` | `--loglevel`
  - `error`
  - `warn`
  - `info`
  - `debug`
- 示例：

```bash
i2l pkg ./src/pages/windmoon --loglevel=error
```

#### page

- 说明：转换一个具体页面
- 输入：路径
- 可选参数：`-l` | `--loglevel`
  - `error`
  - `warn`
  - `info`
  - `debug`
- 可选参数：`-a` | `--alia`
- 示例：

```bash
i2l page ./src/pages/windmoon/setPrice --loglevel=error
i2l page ./src/styles -a # 将style目录中的公共图片，转成～/style/assest/images/xxx.png
```

#### clear

- 说明：清除当前转换内容
- 示例：

```bash
i2l clear
```

#### docs

- 说明：在终端查看 readme
- 示例：

```bash
i2l docs
```

#!/usr/bin/env node
const path = require("path");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const prettier = require("prettier");
const { program } = require("commander");
const { default: PQueue } = require("p-queue");
const { exec, spawn } = require("child_process");
const promiseRetry = require("promise-retry");
const cliProgress = require("cli-progress");
const ora = require("ora");

const {
  flatDeep,
  getPathFromWorkspace,
  getAllPkgs,
  getAllPageInPkg,
  walkSync,
  getUrlWithHttps,
  download,
  unbackslash,
  getRelativePath,
  isFileType,
  getImageName,
  getParser,
  defaultOptions,
  root,
} = require("./utils/helper");

if (!Promise.allSettled) {
  Promise.allSettled = (promises) =>
    Promise.all(
      promises.map((promise, i) =>
        promise
          .then((value) => ({
            status: "fulfilled",
            value,
          }))
          .catch((reason) => ({
            status: "rejected",
            reason,
          }))
      )
    );
}

program.addHelpText(
  "beforeAll",
  `
  ██╗███╗   ███╗ █████╗  ██████╗ ███████╗██████╗ ██╗      ██████╗  ██████╗ █████╗ ██╗     
  ██║████╗ ████║██╔══██╗██╔════╝ ██╔════╝╚════██╗██║     ██╔═══██╗██╔════╝██╔══██╗██║     
  ██║██╔████╔██║███████║██║  ███╗█████╗   █████╔╝██║     ██║   ██║██║     ███████║██║     
  ██║██║╚██╔╝██║██╔══██║██║   ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║██║     ██╔══██║██║     
  ██║██║ ╚═╝ ██║██║  ██║╚██████╔╝███████╗███████╗███████╗╚██████╔╝╚██████╗██║  ██║███████╗
  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝
                                                                                          
  `
);

program.addHelpText(
  "afterAll",
  `
ps:
  1.默认都是以src/pages作为基准
  2.会自动排除activitys,assets,demo目录
  3.转换基于正则，可能存在错误，请仔细验证结果
`
);

program
  .command("all")
  .description("从src/pages开始转换所有的资源")
  .argument("<fakePkgs>", "马甲包")
  .option("-l, --loglevel <level>", "日志级别")
  .action((fakePkgs, { loglevel }) => {
    const options = {
      ...defaultOptions,
      fakePkgList: fakePkgs.split(","),
      loglevel,
    };

    const allPkgs = getAllPkgs(options);
    const allPages = allPkgs.reduce(
      (p, c) => p.concat(getAllPageInPkg(c, options)),
      []
    );
    main(allPages, options);
  });

program
  .command("pkg")
  .description("转换一个马甲包的资源")
  .argument("<p>", "文件路径")
  .option("-l, --loglevel <level>", "日志级别")
  .action((p, { loglevel }) => {
    const options = {
      ...defaultOptions,
      loglevel,
    };
    const allPages = getAllPageInPkg(getPathFromWorkspace(p), options);
    main(allPages, options);
  });

program
  .command("page")
  .description("转换一个页面的资源")
  .argument("<p>", "文件路径")
  .option("-l, --loglevel <level>", "日志级别")
  .action((p, { loglevel }) => {
    const options = {
      ...defaultOptions,
      loglevel,
    };
    main([getPathFromWorkspace(p)], options);
  });

program
  .command("clear")
  .description("清除当前git更改")
  .action(() => {
    exec("git checkout -f");
    exec("git clean -d -f");
  });

program
  .command("docs")
  .description("查看README")
  .action(() => {
    spawn(
      "node",
      [
        path.resolve(__dirname, "./node_modules/mdless"),
        path.resolve(__dirname, "./README.md"),
      ],
      { shell: true, stdio: "inherit" }
    );
  });

program.parse(process.argv);

async function main(allPages, options) {
  const spinner = ora("处理中...\n").start();
  const progressBar = new cliProgress.SingleBar(
    {
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.shades_classic
  );
  try {
    const { log, close, setLevel } = require("./utils/log");
    if (!options.loglevel) {
      close();
    } else {
      setLevel(options.loglevel);
    }
    const queue = new PQueue({
      concurrency: options.downloadConcurrency,
      autoStart: false,
      timeout: 5000,
    });
    const prettierConfig = await prettier.resolveConfig(
      getPathFromWorkspace(".prettierrc")
    );
    log("warn", `prettier配置:\n`, prettierConfig);
    log("info", `待处理页面:\n`, allPages.length);
    log("info", allPages);
    allPages.forEach((page) => {
      const caches = new Map();
      if (!existsSync(path.resolve(page, options.entryFile))) {
        log(
          "error",
          `${page}可能不是一个正确的页面入口，请检查你的输入参数/项目结构`
        );
      }
      const assestPath = path.join(page, options.outputDir);
      const curPageFiles = flatDeep(walkSync(page), Infinity);
      const { testReg } = options;
      curPageFiles.forEach((file) => {
        const ext = path.extname(file);
        const parser = getParser(ext);
        let fileStr = parser
          ? prettier.format(readFileSync(file, { encoding: "utf8" }), {
              parser,
              ...prettierConfig,
            })
          : readFileSync(file, { encoding: "utf8" });
        fileStr = unbackslash(fileStr);

        if (testReg.test(fileStr)) {
          const newRes = fileStr.replace(options.replaceReg, (match) => {
            const url = match.match(testReg)[0];
            log("warn", "match", match, "in", file);
            log("info", "匹配到图片:", url);

            const filename = getImageName(url);
            if (!caches.get(filename)) {
              caches.set(filename, true);
              queue.add(() =>
                promiseRetry(function (retry, number) {
                  if (number > 1) {
                    log("warn", `第${number}次尝试下载图片${url}`);
                  }
                  return download(getUrlWithHttps(url), assestPath).catch(
                    retry
                  );
                })
              );
            }

            if (isFileType(file, "js")) {
              if (match.indexOf("src") > -1) {
                return `src={require('${getRelativePath(
                  file,
                  assestPath,
                  filename
                )}')}`;
              } else if (match.indexOf("url") > -1) {
                return (
                  "`url(" +
                  "${require('" +
                  getRelativePath(file, assestPath, filename) +
                  "')}" +
                  ")`"
                );
              }
              return (
                "require('" + getRelativePath(file, assestPath, filename) + "')"
              );
            }

            if (isFileType(file, "less")) {
              return `url('${getRelativePath(file, assestPath, filename)}')`;
            }
          });
          writeFileSync(file, newRes);
        }
      });
    });
    queue.on("next", () => {
      progressBar.increment(1);
    });
    queue.start();
    progressBar.start(queue.size, 0);
    await queue.onIdle();
  } catch (e) {
    console.log(e);
  } finally {
    progressBar.stop();
    spinner.succeed("转换完成");
    console.log(`
      -----🌈----\n
      git diff / git status 查看转换结果
      i2l clear 还原
      -----🌈----\n
  `);
    process.exit();
  }
}

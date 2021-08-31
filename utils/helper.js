const axios = require("axios");
const Diff = require("diff");
const path = require("path");
require("colors");
const {
  readdirSync,
  lstatSync,
  createWriteStream,
  existsSync,
  mkdirSync,
} = require("fs");
const { log } = require("./log");

const defaultOptions = {
  fakePkgList: [], // 马甲包
  entryPath: "./src/pages/",
  entryFile: "index.js",
  ignorePageReg: /^(assets?|activitys?|demo)$/,
  testReg: /(https?:)?\/\/(img\.|media\.)+[^\s'",;]+/g,
  replaceReg:
    /([^\s]*)(['"]+(https?:)?\/\/(img\.|media\.)+[^\s),;}>]+)([^\s,;>]*)/g,
  outputDir: "assets/images/",
  loglevel: "verbose",
  downloadConcurrency: 10,
};

const root = process.cwd();
const getPathFromWorkspace = (p) => path.resolve(root, p);

const getAllPkgs = ({ fakePkgList, entryPath }) =>
  fakePkgList
    .map((f) => getPathFromWorkspace(`${entryPath}${f}`))
    .concat(getPathFromWorkspace(entryPath));

const getAllPageInPkg = (entry, { ignorePageReg, fakePkgList }) =>
  readdirSync(entry)
    .filter(
      (e) =>
        lstatSync(path.join(entry, e)).isDirectory() &&
        !ignorePageReg.test(e) &&
        !fakePkgList.includes(e)
    )
    .map((e) => path.join(entry, e));

const flatDeep = (arr, d = 1) =>
  d > 0
    ? arr.reduce(
        (acc, val) =>
          acc.concat(Array.isArray(val) ? flatDeep(val, d - 1) : val),
        []
      )
    : arr.slice();

const walkSync = (dir) => {
  if (!lstatSync(dir).isDirectory()) {
    return dir;
  }
  return readdirSync(dir).map((f) => walkSync(path.join(dir, f))); // `join("\n")`
};

const isFileType = (f, t) => path.extname(f) === `.${t}`;

const getDirectories = (source) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) => dir.name);

const getImageName = (url) => url.replace(/^.*[\\\/]/, "");

const streamToPromise = (stream) => {
  return new Promise((resolve, reject) => {
    stream.on("end", resolve);
    stream.on("error", reject);
  });
};
const download = async (url, dir, retry) => {
  try {
    const filename = getImageName(url);
    const absoultPath = `${dir}/${filename}`;
    if (existsSync(absoultPath)) {
      return Promise.resolve("");
    }
    log("info", `文件下载：${url}`);
    const response = await axios({
      method: "get",
      url,
      responseType: "stream",
    });
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (response && response.data) {
      response.data.pipe(createWriteStream(absoultPath));
    }
    await streamToPromise(response.data);
  } catch (error) {
    retry && retry();
  }
};

const getParser = (ext) =>
  ({
    ".js": "babel",
    ".jsx": "babel",
    // ".less": "less", // https://github.com/prettier/prettier/issues/5653
  }[ext]);

const getUrlWithHttps = (str) => "https:" + str.replace(/https?:/, "");

const getRelativePath = (originFile, assest, filename) =>
  `./${path.relative(path.dirname(originFile), assest)}/${filename}`;

const removeQuote = (str) => str.slice(1, -1);

const diffTwoString = (one, other) => {
  const diff = Diff.diffChars(one, other);

  diff.forEach((part) => {
    const color = part.added ? "green" : part.removed ? "red" : "grey";
    process.stderr.write(part.value[color]);
  });
};

const unbackslash = (s) =>
  s.replace(/\\([\\rnt'"])/g, function (match, p1) {
    if (p1 === "n") return "\n";
    if (p1 === "r") return "\r";
    if (p1 === "t") return "\t";
    if (p1 === "\\") return "\\";
    return p1; // unrecognised escape
  });

module.exports = {
  diffTwoString,
  removeQuote,
  getRelativePath,
  download,
  getImageName,
  getDirectories,
  isFileType,
  walkSync,
  flatDeep,
  getAllPageInPkg,
  getAllPkgs,
  getPathFromWorkspace,
  getUrlWithHttps,
  getParser,
  unbackslash,
  root,
  defaultOptions,
};

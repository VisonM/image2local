const logger = require("node-color-log");

function myLog(level, ...args) {
  if (level === "info") {
    logger.info(...args);
  } else if (level === "warn") {
    logger.warn(...args);
  } else if (level === "error") {
    logger.error(...args);
  }
}

module.exports.close = function () {
  logger.setLevel("disable");
};
module.exports.open = function () {
  logger.setLevel("debug");
};
module.exports.log = myLog;

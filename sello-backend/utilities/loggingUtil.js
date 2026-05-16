/**
 * Sello — Simple Logger Utility
 * Logs structured messages with timestamps to console.
 */

const isDev = (process.env.NODE_ENV || 'development') === 'development';

function timestamp() {
  return new Date().toISOString();
}

function info(module, event, data = {}) {
  console.log(JSON.stringify({
    level    : 'INFO',
    timestamp: timestamp(),
    module,
    event,
    ...data
  }));
}

function error(module, event, data = {}) {
  console.error(JSON.stringify({
    level    : 'ERROR',
    timestamp: timestamp(),
    module,
    event,
    ...data
  }));
}

function warn(module, event, data = {}) {
  if (isDev) {
    console.warn(JSON.stringify({
      level    : 'WARN',
      timestamp: timestamp(),
      module,
      event,
      ...data
    }));
  }
}

module.exports = { info, error, warn };

/**
 * Sello — Simple Logger Utility
 * Logs structured messages with timestamps to console.
 */

const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

const isDev = (process.env.NODE_ENV || 'development') === 'development';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[91m',      // Light Red for Errors
  yellow: '\x1b[93m',   // Light Yellow for API Hits
  white: '\x1b[37m'     // White for everything else
};

function timestamp() {
  return new Date().toISOString();
}

function getStorage() {
  return asyncLocalStorage;
}

function getStore() {
  return asyncLocalStorage.getStore();
}

function formatDevLog(level, module, event, data) {
  const time = new Date().toLocaleTimeString();
  const reqId = data.reqId ? `[${data.reqId}]` : '';

  // 1. Errors -> Red
  if (level === 'ERROR' || event === 'QUERY_ERROR' || event === 'TRANSACTION_QUERY_ERROR') {
    if (module === 'Database') {
      return `${colors.red}${colors.bold}[${time}] DB_ERR ${reqId} Error: ${data.error}\nSQL: ${data.sql}${colors.reset}\n`;
    }
    const dataCopy = { ...data };
    delete dataCopy.reqId;
    const dataStr = Object.keys(dataCopy).length ? `\n${JSON.stringify(dataCopy, null, 2)}` : '';
    return `${colors.red}${colors.bold}[${time}] [${module}] ${event} ${reqId}${colors.reset}${colors.red}${dataStr}${colors.reset}\n`;
  }

  // 2. API Hit (REQUEST_START) -> Yellow
  if (module === 'API' && event === 'REQUEST_START') {
    const bodyStr = data.body && Object.keys(data.body).length ? `\n${colors.dim}Body: ${JSON.stringify(data.body, null, 2)}${colors.reset}` : '';
    return `${colors.yellow}${colors.bold}[${time}] API_HIT ${reqId} ${data.method} ${data.url}${colors.reset}${bodyStr}\n`;
  }

  // 3. Everything Else -> White
  if (module === 'API' && event === 'REQUEST_COMPLETE') {
    const resStr = data.response ? `\n${colors.dim}Response: ${JSON.stringify(data.response, null, 2)}${colors.reset}` : '';
    return `${colors.white}${colors.bold}[${time}] API_RES ${reqId} ${data.method} ${data.url} -> Status: ${data.statusCode} (${data.durationMs}ms)${colors.reset}${resStr}\n`;
  }

  if (module === 'Database') {
    if (event === 'QUERY_EXECUTE' || event === 'TRANSACTION_QUERY_EXECUTE') {
      const paramsStr = data.params && data.params.length ? ` | Params: ${JSON.stringify(data.params)}` : '';
      return `${colors.white}[${time}] DB_EXEC ${reqId} SQL: ${data.sql}${colors.dim}${paramsStr}${colors.reset}`;
    }
    if (event === 'QUERY_SUCCESS' || event === 'TRANSACTION_QUERY_SUCCESS') {
      const resultsStr = data.results ? `\n${colors.dim}Result: ${JSON.stringify(data.results, null, 2)}${colors.reset}` : '';
      return `${colors.white}[${time}] DB_SUCC ${reqId} SQL: ${data.sql}${resultsStr}\n`;
    }
  }

  // Fallback / General Logs -> White
  const dataCopy = { ...data };
  delete dataCopy.reqId;
  const dataStr = Object.keys(dataCopy).length ? `\n${JSON.stringify(dataCopy, null, 2)}` : '';
  return `${colors.white}[${time}] [${module}] ${event} ${reqId}${colors.reset}${dataStr}`;
}

function info(module, event, data = {}) {
  if (isDev) {
    console.log(formatDevLog('INFO', module, event, data));
  } else {
    console.log(JSON.stringify({
      level    : 'INFO',
      timestamp: timestamp(),
      module,
      event,
      ...data
    }));
  }
}

function error(module, event, data = {}) {
  if (isDev) {
    console.error(formatDevLog('ERROR', module, event, data));
  } else {
    console.error(JSON.stringify({
      level    : 'ERROR',
      timestamp: timestamp(),
      module,
      event,
      ...data
    }));
  }
}

function warn(module, event, data = {}) {
  if (isDev) {
    console.warn(formatDevLog('WARN', module, event, data));
  } else {
    console.warn(JSON.stringify({
      level    : 'WARN',
      timestamp: timestamp(),
      module,
      event,
      ...data
    }));
  }
}

module.exports = { info, error, warn, getStorage, getStore };

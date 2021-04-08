#!/usr/bin/env node

var createBots = require('./lib/helpers').createBots;
var logger = require('./lib/logging');

/* istanbul ignore next*/
if (!module.parent) {
  require('./lib/cli')();
}

module.exports = createBots;

#!/usr/bin/env node

var program = require('commander');
var path = require('path');
var checkEnv = require('check-env');
var logger = require('./logging')

function run(createBots) {
  program
    .version(require('../package.json').version)
    .option('-t, --test <command>', "Run a command locally.")
    .option('-c, --config <path>',
      'Sets the path to the config file, otherwise read from the env variable CONFIG_FILE.'
    )
    .parse(process.argv);

  // If no config option is given, try to use the env variable:
  const options = program.opts();

  if (!options.test)
  {
    if (!options.config) checkEnv(['CONFIG_FILE']);
    else process.env.CONFIG_FILE = options.config;

    const config = path.resolve(process.cwd(), process.env.CONFIG_FILE);
    logger.debug(`Using configuration file: ${config}`);

    var configFile = require(config);

    createBots(configFile);
  }
  else
  {
    botcommands.processUserCommand(options.test, function(r) {
      console.log("Done. Output:");
      console.log(r.text);
    });
  }
}

module.exports = run;

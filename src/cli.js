#!/usr/bin/env node

import { program } from 'commander';
import path from 'path';
import checkEnv from 'check-env';
import logger from './logging.js';
import packageInfo from '../package.json' assert { type: "json" }
import { pathToFileURL } from 'url';

export default async function run(createBots) {
  program
    .version(packageInfo.version)
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

    var configURL = pathToFileURL(config);
    const configData = (await import(configURL)).default;
    await createBots(configData);
  }
  else
  {
    botcommands.processUserCommand(options.test, function(r) {
      console.log("Done. Output:");
      console.log(r.text);
    });
  }
}

#!/usr/bin/env node

import Bridge from './bridge.js';
import DiscordBot from "./discordbot.js"
import SlackBot from "./slackbot.js"
import run from "./cli.js"

export default async function createBots(configuration) {
  const bridge = new Bridge();

  // The config file can be both an array and an object
  if (Array.isArray(configuration)) {
    for (const config of configuration) {
      if (config.bot === "discord") {
        let bot = new DiscordBot(config);
        bridge.addBot(bot);
      } else if (config.bot === "slack") {
        let bot = new SlackBot(config);
        bridge.addBot(bot);
      }     
    };

    await bridge.start();
  } else {
    throw "Invalid format of configuration file";
  }

  return bridge;
};

//if (!module.parent) {
  await run(createBots);
//}

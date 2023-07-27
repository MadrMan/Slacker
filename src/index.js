#!/usr/bin/env node

const Bridge = require('./bridge');
const botcommands = require('./botcommands');
const DiscordBot = require("./discordbot")
const SlackBot = require("./slackbot")

createBots = async function(configuration) {
  const bridge = new Bridge();

  // The config file can be both an array and an object
  if (Array.isArray(configuration)) {
    for (config of configuration) {
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

if (!module.parent) {
  require('./cli')(createBots);
}

module.exports = createBots;


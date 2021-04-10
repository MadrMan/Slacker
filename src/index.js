#!/usr/bin/env node

var Bridge = require('./bridge');
var botcommands = require('./botcommands');
var DiscordBot = require("./discordbot")
var SlackBot = require("./slackbot")

createBots = function(configuration) {
  var bridge = new Bridge();

  // The config file can be both an array and an object
  if (Array.isArray(configuration)) {
    for (config of configuration) {
      if (config.bot === "discord") {
        var bot = new DiscordBot(config);
      } else if (config.bot === "slack") {
        var bot = new SlackBot(config);
      }

      bridge.addBot(bot);
      bridge.start();
    };
  } else {
    throw "Invalid format of configuration file";
  }

  return bridge;
};

if (!module.parent) {
  require('./cli')(createBots);
}

module.exports = createBots;


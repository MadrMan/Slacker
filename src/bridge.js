var botcommands = require('./botcommands');
var logger = require('./logging');

class Bridge
{
    constructor() {
        this.bots = [];
    }

    addBot(bot) {
        this.bots.push(bot);
    }

    start() {
        for (var bot of this.bots) {
            bot.messageReceived = this.messageReceived.bind(this);
            bot.start();
        }

        botcommands.initializeIntervals(function(response, channel) {
            var channelid = this.slack.dataStore.getChannelOrGroupByName(channel).id;
            this.handleOutwardMessage(response, null, channel, true);
        }.bind(this));
    }

    messageReceived(bot, username, channel, message) {
        logger.debug(`Got message in ${channel ? channel : "pm"}: <${username}> ${message}`)

        botcommands.processUserCommand(message, function(response) {
            if (!response.channel) {
                bot.sendMessage(response);
            } else {
                for (var bot in response) {
                    bot.sendMessage(response);
                }
            }
        });
    }
}

module.exports = Bridge;
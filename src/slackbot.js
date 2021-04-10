var SlackRtmClient = require('@slack/rtm-api').RTMClient;
var SlackWebClient = require('@slack/web-api').WebClient;
var logger = require('./logging');

class SlackBot {
    constructor(config) {
        this.config = config;
        this.users = [];
        this.channels = [];
    }

    start() {
        this.slack = new SlackRtmClient(this.config.token, {
            logLevel: 'error',
            autoReconnect: true,
            autoMark: true    
        }); 

        this.slackweb = new SlackWebClient(this.config.token);

        this.slack.on('message', message => {
            // Ignore bot messages and people leaving/joining
            if (message.type === 'message') {
                if (!message.subtype) {
                    var user = this.users.find(user => user.id === message.user);
                    var slackChannel = this.channels.find(channel => channel.id === message.channel);

                    // If we found a channel, map it to the mapping
                    if (slackChannel) {
                        var mappedChannel = this.config.channels.find(channel => channel.slack === slackChannel.name);
                        
                        if (mappedChannel) {
                            var channel = mappedChannel.id;
                        }
                    }

                    var username = user ? user.real_name : "???";
                    this.messageReceived(this, username, channel, message.text);
                }
            }
        });

        this.slackweb.users.list().then(result => {
            if (!result.ok) {
                logger.error("Slackweb user list() failed");
            }

            for (var user of result.members) {
                this.users.push(user);
            }
        });

        this.slackweb.conversations.list().then(result => {
            if (!result.ok) {
                logger.error("Slackweb channel list() failed");
            }

            for (var channel of result.channels) {
                this.channels.push(channel);
            }
        });
        
        // Done loading data, connect RTM and start getting callbacks
        this.slack.start();
    }

    channelToSlackChannel(channel) {
        for (mapping of this.config.channels) {
            if (mapping[channel]) {
                return mapping[channel]
            }
        }

        return undefined;
    }

    sendMessage(message) {
        if (message.channel) {
            var mappedChannel = this.config.channels.find(channel => channel.id === message.channel);

            if (!mappedChannel) {
                // Not in our mapping, ignore
                return;
            }

            var slackChannel = this.channels.find(channel => channel.name === mappedChannel.slack)

            if (!slackChannel) {
                // No mapping for selected channel for slack, ignore
                return;
            }
        }

        var data = {
            username: message.username,
            parse: 'full',
            icon_url: message.icon,
        };

        var replyText = response.text;

        if (message.attachment) {
            // Replacing our message with our cool attachment
            replyText = "";
            data.attachments = [ message.attachment ];
        }
        
        this.slackweb.chat.postMessage(slackChannel.id, replyText, data);

        /*var data = {
            username: author,
            parse: 'full',
            icon_url: 'http://api.adorable.io/avatars/48/' + author + '.png'
          };
          logger.debug('Sending message to Slack', text, channel, '->', slackChannelName);
          this.slackweb.chat.postMessage(slackChannel.id, text, data);*/
    }
}

module.exports = SlackBot;
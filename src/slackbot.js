const SlackRtmClient = require('@slack/rtm-api').RTMClient;
const SlackWebClient = require('@slack/web-api').WebClient;
const logger = require('./logging');
const https = require('https');

const mentionRegex = /<@(\w+)>/g//

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
                if (message.subtype === "bot_message") {
                    return;
                }

                if (message.subtype === "message_changed") {
                    return;
                }

                if (message.hidden) {
                    return;
                }

                let user = this.users.find(user => user.id === message.user);
                let slackChannel = this.channels.find(channel => channel.id === message.channel);

                // If we found a channel, map it to the mapping
                if (slackChannel) {
                    let mappedChannel = this.config.channels.find(channel => channel.slack === slackChannel.name);
                    
                    if (mappedChannel) {
                        var channel = mappedChannel.id;
                    }
                }

                const that = this;
                const replaceMentions = function(message) {
                    return message.replaceAll(mentionRegex,(match, userId) => `@${that.users.find(user => user.id === userId)?.profile.real_name_normalized || "???"}`)
                }

                let files = message.files?.map(f => new Promise((resolve, reject) => {
                    https.get(f.url_private, {
                        headers: {
                            Authorization: `Bearer ${this.config.token}`
                        }
                    }, res => {
                        if (res.statusCode !== 200) {
                            reject("Failed to download");
                            return;
                        }

                        let data = [];
                        res.on("data", chunk => data.push(chunk));
                        res.on('end', () => resolve({
                            file: Buffer.concat(data),
                            name: f.name
                        }));
                        res.on("error", err => reject(err));
                    });
                }));

                let username = user ? user.real_name : "???";
                const textWithMentions = replaceMentions(message.text ? message.text : message.message?.text);
                this.messageReceived(this, username, {
                    channel: channel,
                    files: files,
                    user_icon: user.profile?.image_512,
                    slack: { 
                        channel: message.channel
                    }},
                    textWithMentions
                );
            }
        });

        this.slackweb.users.list().then(result => {
            if (!result.ok) {
                logger.error("Slackweb user list() failed");
            }

            for (let user of result.members) {
                this.users.push(user);
            }
        });

        this.slackweb.conversations.list().then(result => {
            if (!result.ok) {
                logger.error("Slackweb channel list() failed");
            }

            for (let channel of result.channels) {
                this.channels.push(channel);
            }
        });
        
        // Done loading data, connect RTM and start getting callbacks
        this.slack.start();
    }

    sendMessage(message) {
        var slackMessage = {
            username: message.command ? message.command : message.username,
            parse: "full",
            icon_url: message.icon ? message.icon : message.context.user_icon
        };

        if (message.context.channel) {
            let mappedChannel = this.config.channels.find(channel => channel.id === message.context.channel);

            if (!mappedChannel) {
                // Not in our mapping, ignore
                return;
            }

            let slackChannel = this.channels.find(channel => channel.name === mappedChannel.slack)

            if (!slackChannel) {
                // No mapping for selected channel for slack, ignore
                return;
            }

            slackMessage.channel = slackChannel.id;
        } else {
            slackMessage.channel = message.context.slack.channel;
        }

        slackMessage.text = message.text ? message.text : " ";

        if (message.attachment) {
            // Replacing our message with our cool attachment
            slackMessage.attachments = [ message.attachment ];
        } else {
            
        }

        if (message.bridge && message.context.slack) {
            if (slackMessage.channel === message.context.slack.channel) {
                // We're bridging and the source equals the dest, abort
                return;
            }
        }
        
        /*if (message.context.files) {
            Promise.all(message.context.files).then(files => {
                files.map((f, i) =>
                    this.slackweb.files.upload({
                        channels: slackMessage.channel,
                        filename: f.name,
                        file: f.file,
                        initial_comment: (i === 0) ? message.text : undefined
                    }))
            })
        } else {
            this.slackweb.chat.postMessage(slackMessage);
        }*/

       let fileBlocks = Promise.all(message.context.files ? message.context.files : []).then(files => {
            return files.map(f => {
                return {
                    image_url: f.original_url
                }
            });

            /*let uploads = Promise.all(files.map(f =>
                this.slackweb.files.upload({
                    filename: f.name,
                    file: f.file
                })))
            return uploads.then(r => r.filter(r => r.ok).map(r => {
                return {
                    type: "image",
                    image_url: r.file.url_private,
                    alt_text: r.file.name,
                    title: {
                        type: "plain_text",
                        text: r.file.name
                    }
                }
            }));*/
        }).catch(logger.error);

        fileBlocks.then(blocks => {
            if (blocks && blocks.length) {
                //slackMessage.text += blocks.map(f => ` <${f.image_url}|${f.title.text}>`).join(' ');
                slackMessage.text += blocks.map(f => f.image_url).join(' ');
                slackMessage.mrkdwn = true;
                slackMessage.parse = "full";
            }

            this.slackweb.chat.postMessage(slackMessage);
        });

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
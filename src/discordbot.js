const { Client, GatewayIntentBits, Events } = require("discord.js")
const logger = require("./logging")
const https = require('https');

const mentionRegex = /<@!(\w+)>/g//;
const slackLinkRegex = /^\[([^\]]+)\]\(([^\)].+)\)/g//;

const replaceLinks = function(message) {
    if(!message) return;
    const matches = [...message.matchAll(slackLinkRegex)];
    let modifiedMessage = message;
    matches.forEach(match => {
        const url = `${match[2]}`;
        const name = match[1] || url;
        modifiedMessage = modifiedMessage.replace(match[0], `[${name}](${url})`);
    });
    return modifiedMessage;
}

class DiscordBot {
    constructor(config) {
        this.config = config;
    }

    start() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages, 
                GatewayIntentBits.MessageContent
            ]
        });

        this.client.on(Events.ClientReady, () => {
            logger.info("Discord ready");
        });

        this.client.on(Events.MessageCreate, msg => {
            // If we found a channel, map it to the mapping
            if  (msg.author.bot || msg.author.id === this.client.user.id) {
                return;
            }

            if (msg.channel) {
                if (msg.guild) {
                    let mappedGuild = this.config.guilds.find(guild => guild.id === msg.guild.id);

                    if (mappedGuild) {
                        let mappedChannel = mappedGuild.channels.find(channel => channel.discord === msg.channel.name);

                        if  (mappedChannel) {
                            var channel = mappedChannel.id;
                        }
                    }
                }
            }

            let files = msg.attachments.map(f => new Promise((resolve, reject) => {
                https.get(f.url, res => {
                    if (res.statusCode !== 200) {
                        reject("Failed to download");
                        return;
                    }

                    let data = [];
                    res.on("data", chunk => data.push(chunk));
                    res.on('end', () => resolve({
                        file: Buffer.concat(data),
                        name: f.name,
                        original_url: f.url
                    }));
                    res.on("error", err => reject(err));
                });
            }));

            const replaceMentions = async message => {
                const arr = [...message.matchAll(mentionRegex)];
                const userPromises = arr.map(match => this.client.users.fetch(match[1]).then(user => [user, match[0]]))
                const users = await Promise.all(userPromises);

                let modifiedMessage = message;
                users.map(async replace => {
                    const [user, match] = replace;
                    modifiedMessage = modifiedMessage.replace(match, `@${user.username}`);
                })

                return modifiedMessage;
            }

            (async() => {
                const content = await replaceMentions(msg.content);

                this.messageReceived(this, msg.member ? msg.member.displayName : msg.author.username, {
                    channel: channel,
                    files: files,
                    user_icon: msg.author.displayAvatarURL({
                        format: 'png'
                    }),
                    discord: {
                        channel: msg.channel
                    }},
                    content);
            })();
        });

        this.client.login(this.config.token);
    }

    async getWebhookForChannel(mappedChannel, guildChannel) {
        if (!mappedChannel.webhook) {
            mappedChannel.webhook = (async() => {
                let hooks = await guildChannel.fetchWebhooks();
                let webhook = hooks.find(v => v.owner && v.owner.id === this.client.user.id);

                if (webhook) {
                    return webhook;
                }

                return guildChannel.createWebhook(this.client.user.username, {
                    reason: "Bridging channel"
                });
            })();
        }

        return mappedChannel.webhook;
    }

    sendChannelMessage(channel, webhook, message) {
        const messageText = replaceLinks(message.text);

        Promise.all(message.context.files ? message.context.files : []).then(files => {
            let sender = message.command ? message.command : message.username;
            let attach = files?.map(f => {
                return {
                    attachment: f.file,
                    name: f.name
                }
            });

            if (webhook) {
                return webhook.send({
                    content: messageText,
                    username: sender,
                    avatarURL: message.icon ? message.icon : message.context.user_icon,
                    files: attach
                });
            } else {
                return channel.send({
                    content: `<${sender}> ${messageText ? messageText : ""}`,
                    files: attach
                })
            }
        }).catch(logger.error);
    }

    async sendMessage(message) {
        if (message.context.channel) {
            for (let guild of this.config.guilds) {
                let mappedChannel = guild.channels.find(channel => channel.id === message.context.channel);

                const discordGuild = await this.client.guilds.fetch(guild.id);
                const channelCache = discordGuild.channels.cache;

                const guildChannel = [...channelCache.values()].find(v => {
                    return v.isTextBased() && v.name === mappedChannel.discord;
                });

                if (guildChannel) {
                    if (message.bridge && message.context.discord) {
                        if (guildChannel.id === message.context.discord.channel.id) {
                            // Don't echo back to bridge users
                            return;
                        }
                    }

                    const webhook = await this.getWebhookForChannel(mappedChannel, guildChannel);
                    this.sendChannelMessage(guildChannel, webhook, message);
                }
            }
        } else {
            this.sendChannelMessage(message.context.discord.channel, undefined, message);
        }
    }
}

module.exports = DiscordBot;
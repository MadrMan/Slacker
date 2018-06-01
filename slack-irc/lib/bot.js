var _ = require('lodash');
var irc = require('irc');
var logger = require('winston');
var SlackRtmClient = require('@slack/client').RtmClient;
var SLACK_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var SLACK_RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var SlackWebClient = require('@slack/client').WebClient;
var errors = require('./errors');
var validateChannelMapping = require('./validators').validateChannelMapping;
var emojis = require('./emoji');
var botcommands = require('./botcommands');
var util = require('util');

var ALLOWED_SUBTYPES = ['me_message'];
var REQUIRED_FIELDS = ['server', 'nickname', 'channelMapping', 'token'];

/**
 * An IRC bot, works as a middleman for all communication
 * @param {object} options - server, nickname, channelMapping, outgoingToken, incomingURL
 */
function Bot(options) {
  logger.level = 'debug';

  REQUIRED_FIELDS.forEach(function(field) {
    if (!options[field]) {
      throw new errors.ConfigurationError('Missing configuration field ' + field);
    }
  });

  logger.error(" === STARTUP === ");

  validateChannelMapping(options.channelMapping);

  this.slack = new SlackRtmClient(options.token, {
    logLevel: 'error',
    autoReconnect: true,
    autoMark: true    
  });

  this.slackweb = new SlackWebClient(options.token);

  this.server = options.server;
  this.nickname = options.nickname;
  this.ircOptions = options.ircOptions;
  this.commandCharacters = options.commandCharacters || [];
  this.channels = _.values(options.channelMapping);
  this.ircConnected = false;

  this.channelMapping = options.channelMapping;

  // Remove channel passwords from the mapping and lowercase IRC channel names
  _.forOwn(this.channelMapping, function(ircChan, slackChan, mapping) {
    logger.debug('Mapping ' + ircChan + ' -> ' + slackChan);
    mapping[slackChan] = ircChan.split(' ')[0].toLowerCase();
  }, this);

  logger.debug(this.channelMapping);

  this.invertedMapping = _.invert(this.channelMapping);

  this.autoSendCommands = options.autoSendCommands || [];
}

Bot.prototype.connect = function() {
  logger.debug('Connecting to IRC and Slack');
  this.slack.start();

  var ircOptions = _.assign({
    userName: this.nickname,
    realName: this.nickname,
    channels: this.channels,
    floodProtection: true,
    floodProtectionDelay: 500
  }, this.ircOptions);

  this.ircClient = new irc.Client(this.server, this.nickname, ircOptions);
  this.attachListeners();

  botcommands.initializeIntervals(function(response, channel) {
    var channelid = this.slack.dataStore.getChannelOrGroupByName(channel).id;
    this.handleOutwardMessage(response, null, channel, true);
  }.bind(this));
};

Bot.prototype.attachListeners = function() {
  this.slack.on(SLACK_CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function() {
    logger.debug('Connected to Slack');
  });

  this.ircClient.on('registered', function(message) {
    logger.debug('Registered event: ', message);
    this.autoSendCommands.forEach(function(element) {
      this.ircClient.send.apply(this.ircClient, element);
    }, this);
    this.ircConnected = true;
  }.bind(this));

  this.ircClient.on('error', function(error) {
    logger.error('Received error event from IRC', error);
  });

  this.slack.on(SLACK_RTM_EVENTS.MESSAGE, function(message) {
    // Ignore bot messages and people leaving/joining
    if (message.type === 'message' &&
      (!message.subtype || ALLOWED_SUBTYPES.indexOf(message.subtype) > -1)) {
      this.sendToIRC(message);
      this.processCommand(message.user, message.channel, message.text, false);
    }
  }.bind(this));

  this.ircClient.on('message', function(author, to, text) {
	 this.sendToSlack(author, to, text);
	 this.processCommand(author, to, text, true);
  }.bind(this));

  this.ircClient.on('notice', function(author, to, text) {
    var formattedText = '*' + text + '*';
    this.sendToSlack(author, to, formattedText);
  }.bind(this));

  this.ircClient.on('action', function(author, to, text) {
    var formattedText = '_' + text + '_';
    this.sendToSlack(author, to, formattedText);
  }.bind(this));

  this.ircClient.on('invite', function(channel, from) {
    logger.debug('Received invite:', channel, from);
    if (!this.invertedMapping[channel]) {
      logger.debug('Channel not found in config, not joining:', channel);
    } else {
      this.ircClient.join(channel);
      logger.debug('Joining channel:', channel);
    }
  }.bind(this));
};

Bot.prototype.parseText = function(text) {
  return text
    .replace(/\n|\r\n|\r/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<!channel>/g, '@channel')
    .replace(/<!group>/g, '@group')
    .replace(/<!everyone>/g, '@everyone')
    .replace(/<#(C\w+)\|?(\w+)?>/g, function(match, channelId, readable) {
      return readable || '#' + this.slack.dataStore.getChannelById(channelId).name;
    }.bind(this))
    .replace(/<@(U\w+)\|?(\w+)?>/g, function(match, userId, readable) {
      return readable || '@' + this.slack.dataStore.getUserById(userId).name;
    }.bind(this))
    .replace(/<(?!!)(\S+)>/g, function(match, link) {
      return link;
    })
    .replace(/<!(\w+)\|?(\w+)?>/g, function(match, command, label) {
      if (label) {
        return '<' + label + '>';
      }

      return '<' + command + '>';
    })
    .replace(/\:(\w+)\:/g, function(match, emoji) {
      if (emoji in emojis) {
        return emojis[emoji];
      }

      return match;
    });
};

Bot.prototype.isCommandMessage = function(message) {
  return this.commandCharacters.indexOf(message[0]) !== -1;
};

Bot.prototype.sendToIRC = function(message) {
  if (!this.ircConnected)
  {
    return;
  }
  
  var channel = this.slack.dataStore.getChannelGroupOrDMById(message.channel);
  if (!channel) {
    logger.info('Received message from a channel the bot isn\'t in:',
      message.channel);
    return;
  }

  var channelName = channel.is_channel ? '#' + channel.name : channel.name;
  var ircChannel = this.channelMapping[channelName];
  
  //logger.debug('Channel Mapping', channelName, this.channelMapping[channelName]);
  if (ircChannel) {
    var user = this.slack.dataStore.getUserById(message.user);
    var text = this.parseText(message.text);

    if (this.isCommandMessage(text)) {
      var prelude = 'Command sent from Slack by ' + user.name + ':';
      this.ircClient.say(ircChannel, prelude);
    } else if (!message.subtype) {
      text = '<' + user.name + '> ' + text;
    } else if (message.subtype === 'me_message') {
      text = 'Action: ' + user.name + ' ' + text;
    }

    logger.debug('Sending message to IRC', channelName, text);
    this.ircClient.say(ircChannel, text);
  }
};

Bot.prototype.processCommand = function(author, channelid, text, isirc) {
	botcommands.processUserCommand(text, function(response) {
		this.handleOutwardMessage(response, author, channelid, isirc)
	}.bind(this));
}
	 
Bot.prototype.handleOutwardMessage = function(response, author, channelid, isirc) {
    var slackChannel = null;
    var ircChannel = null;
    if (!isirc)
    {
      slackChannel = this.slack.dataStore.getChannelGroupOrDMById(channelid); // remap to slack channel object

      var channelName = slackChannel.is_channel ? '#' + slackChannel.name : slackChannel.name;
      ircChannel = this.channelMapping[channelName]; // If we come from slack, remap
    }
    else
    {
      ircChannel = channelid;

      slackChannelName = this.invertedMapping[ircChannel.toLowerCase()]; // If we come from irc, remap
      slackChannel = this.slack.dataStore.getChannelOrGroupByName(slackChannelName);
    }

    if (ircChannel && this.ircConnected)
    {
      this.ircClient.say(ircChannel, "[" + response.command + "] " + response.text);
    }

    if (slackChannel)
    {
      var data = {
        username: response.command,
        parse: 'full',
        icon_url: response.icon,
      };

      var replyText = response.text;

      if (response.attachment) {
	      // Replacing our message with our cool attachment
	      replyText = "";
	      data.attachments = [ response.attachment ];
      }
      
      this.slackweb.chat.postMessage(slackChannel.id, replyText, data);
    }
}

Bot.prototype.sendToSlack = function(author, channel, text) {
  var slackChannelName = this.invertedMapping[channel.toLowerCase()];
  if (slackChannelName) {
    var slackChannel = this.slack.dataStore.getChannelOrGroupByName(slackChannelName);

    if (!slackChannel) {
      logger.info('Tried to send a message to a channel the bot isn\'t in: ',
        slackChannelName);
      return;
    }

    var data = {
      username: author,
      parse: 'full',
      icon_url: 'http://api.adorable.io/avatars/48/' + author + '.png'
    };
    logger.debug('Sending message to Slack', text, channel, '->', slackChannelName);
    this.slackweb.chat.postMessage(slackChannel.id, text, data);
  }
};

module.exports = Bot;

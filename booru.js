 //protip: look for " to see stolen code (It is mostly rewritten though, just the image fetching part is the same)
 //actually forget that, I've written/rewritten so much code it's not really a copy anymore
 //help

//scratch the above comments, I rewrote it to work with the other stuff
//aaaaaaaaaa
// -RoadCrosser, one of the times he spammed 'a'

/*jshint esversion: 6*/ //I fucking love es6
var Discord = require("discord.js");
var request = require("request");
var fs = require('fs');
var base64 = require('node-base64-image'); //image to base64 for avy changes
var parseString = require('xml2js').parseString; //for XML apis (Gelbooru pls)

var Auth = require("./auth.json");
var settings = require('./settings.json'); //Blacklists, Users...
var defaultSettings = require('./defaultSettings.json'); //empty settings used to initialize
var sites = require('./sites.json'); //aliases, nsfw? for sites
var helpDocs = require('./helpDocs.json'); //help docs

var getSiteRegex = /=([^\s]*)/;
var getChannelRegex = /<#(\d+)>/;
var serverId = ''; //global vars woo

var bot = new Discord.Client({
  "autoReconnect": true
});

bot.userAgent.url = "https://github.com/AtlasTheBot/Booru-Discord";

var inviteLink = 'http://discordapp.com/oauth2/authorize?client_id=204721731162734592&scope=bot&permissions=0';

bot.on("ready", function () {
  console.log("===\nTime for porn!\n===");
  bot.setPlayingGame('=help');
  changeAvy(); //random avy
});

bot.on("message", function (message) {
  if (message.author.equals(bot.user) || message.author.bot) return; //Don't reply to itself or bots
  if (message.content.indexOf('=') !== 0) return; //Don't bother replying if = isn't at the start

  if (message.channel.server !== undefined) {
    serverId = message.channel.server.id;
  } else {
    serverId = 'dm' + message.author.id; //Settings for DMs (user specific)
  }

  createServerSettings(serverId); //Create settings if none exist (also DM settings)

  console.log("Treating " + message.content + " from " + message.author + " as command!");

  var siteToSearch = message.content.match(getSiteRegex)[1];

  //alias support for sites, so you don't need to type all of the url ('e6' => 'e621.net')
  for(var site in sites){
    if(sites[site].aliases.indexOf(siteToSearch) !== -1) {
      console.log('Expanding ' + siteToSearch + ' to ' + site);
      message.content = message.content.replace('=' + siteToSearch, '=' + site);
      siteToSearch = site;
    }
  }


  if (message.content.indexOf('=blacklist') === 0) {
    if (canEditBlacklist(message) && message.content.substring('=blacklist '.length) !== '') { //only let certain users modify the blacklist
      blacklist(message);
      return;
    } else {
      if (message.content.substring('=blacklist '.length) === ''){
        bot.sendMessage(message.channel, '```xl\nCurrently blacklisted: \n' +
          ((settings[serverId].blacklist.tags[0] !== undefined) ?
            'Tags: ' + settings[serverId].blacklist.tags + '\n' :
            '') +
          ((settings[serverId].blacklist.channels[0] !== undefined) ?
            'Channels: ' + blacklistFormatChannels() + '\n' :
            '') +
          ((settings[serverId].blacklist.sites[0] !== undefined) ?
            'Sites: ' + settings[serverId].blacklist.sites + '\n' :
            '') +
          '```');
        return;
      }
    }
  }

  if (message.content.indexOf('=whitelist') === 0) {
    if (canEditBlacklist(message)) { //only let certain users modify the blacklist
      whitelist(message);
      return;
    } else {
      bot.sendMessage(message.channel, ':no_entry_sign: No, you can\'t get around the blacklist like that');
      return;
    }
  }

  if (message.content.indexOf('=add') === 0) {
    if (canEditBlacklist(message)) { //only let certain users modify the blacklist
      blacklistAddUser(message);
      return;
    } else {
      bot.sendMessage(message.channel, ':no_entry_sign: Yeah... No');
      return;
    }
  }

  if (message.content.indexOf('=remove') === 0) {
    if (canEditBlacklist(message)) { //only let certain users modify the blacklist
      blacklistRemoveUser(message);
      return;
    } else {
      bot.sendMessage(message.channel, ':no_entry_sign:');
      return;
    }
  }

  /*jshint evil: true*/
    if (message.content.indexOf('=eval') === 0) {
      if (message.author.id !== Auth.ownerID) { //ain't nobody else runnin' eval on my watch
          bot.sendMessage(message.channel, 'Nice try, but no.');
          return;
      }
      var content = message.content.replace('=eval', '');
      try {
          var result = eval(content);
          console.log(result);
          bot.sendMessage(message.channel, '`' + result + '`');
      } catch (err) {
          console.log(err);
          bot.sendMessage(message.channel, '`' + err + '`');
      }
      return;
    }

  //Block other commands
  if (blacklistContainsChannel(message.channel.id)) {
    bot.sendMessage(message.channel, 'This channel\'s blacklisted! Sorry!');
    return;
  }

  if (message.content.indexOf('=help') === 0) {
    help(message);
    return;
  }

  if (message.content.indexOf('=avy') === 0) {
    changeAvy();
    bot.sendMessage(message.channel, 'New avy set!');
    return;
  }

  if (message.content.indexOf('=invite') === 0) {
    bot.sendMessage(message.channel, inviteLink);
    return;
  }

  if (settings[serverId].blacklist.sites.indexOf(siteToSearch) !== -1) {
    bot.sendMessage(message.channel, ':no_entry_sign: As much as I\'d love to search that, that site\'s blacklisted here!');
    return;
  }

  bot.startTyping(message.channel); //since the rest is image searching (and that takes quite a bit sometimes)
  //keeps people from thinking the bot died

  if (siteToSearch === 'random' || siteToSearch === 'rand') {
    if (settings[serverId].blacklist.sites.length == Object.keys(sites).length) {
      bot.sendMessage(message.channel, 'All sites are blacklisted...');
      bot.stopTyping(message.channel);
      return;
    }
    siteToSearch = randomSite();
    message.content = message.content.replace('=random', '=rand').replace('=rand', '=' + siteToSearch);
    console.log(message.content);
    console.log('Random! ' + siteToSearch);
  }

  switch (siteToSearch) {
    case '': //if there's no site just give up
      help(message);
    break;

    ///    /post/index.json

    case 'e621.net': //e6
    case 'hypnohub.net': //hh
    case 'lolibooru.moe': //lb
      searchPostsIndex(message);
    break;

    ///    /posts.json

    case 'danbooru.donmai.us': //db
      searchPostsJSON(message);
    break;

    ///    /post.json

    case 'konachan.com': //kc
    case 'konachan.net': //kn
    case 'yande.re': //yd
      searchPostJSON(message);
    break;

    ///    /index.php?page=dapi&s=post&q=index (xml)

    case 'gelbooru.com': //gb
    case 'rule34.xxx': //r34
    case 'safebooru.org': //sb
    case 'tbib.org': //tbib
    case 'xbooru.com': //xb
    case 'youhate.us': //yh
      searchIndexPHP(message);
    break;

    ///     /api/danbooru/find_posts/index.xml

    case 'dollbooru.org': //do
    case 'rule34.paheal.net': //pa
      searchDanbooruAPI(message);
    break;

    default: //give up
      bot.sendMessage(message.channel, 'Sorry! But it\'s not supported (yet?)\nhttps://github.com/AtlasTheBot/Booru-Discord/blob/master/sites.md is a list of all available servers');
  }
  bot.stopTyping(message.channel);
});

/*









*/

function searchPostsIndex(message) {
  var tagsFormatted = formatTags(message);
  if (tagsFormatted === false) return;

  console.log('http://' +  message.content.match(getSiteRegex)[1] + '/post/index.json?tags=order:random+' + tagsFormatted);

  var header = {
    url: 'http://' +  message.content.match(getSiteRegex)[1] + '/post/index.json?tags=order:random+' + tagsFormatted,
    headers: {
      'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var images = JSON.parse(body);
      var index = 0;

      getImagePostsIndex(index, images, message);

    } else {
      parseError(response, body, message);
    }
  });
  return;
}

function searchPostsJSON(message) {
  var tagsFormatted = formatTags(message);
  if (tagsFormatted === false) return;

  var header = {
    url: 'http://' + message.content.match(getSiteRegex)[1] + '/posts.json?tags=order:random+' + tagsFormatted,
    headers: {
    'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var images = JSON.parse(body);
      var index = 0;

      getImagePostsJSON(index, images, message);

    } else {
      parseError(response, body, message);
    }
  });
  return;
}

function searchPostJSON(message) {
  var tagsFormatted = formatTags(message);
  if (tagsFormatted === false) return;

  var header = {
    url: 'http://' + message.content.match(getSiteRegex)[1] + '/post.json?tags=order:random+' + tagsFormatted,
    headers: {
    'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var images = JSON.parse(body);
      var index = 0;

      getImagePostJSON(index, images, message);
    } else {
      parseError(response, body, message);
    }
  });
  return;
}

function searchIndexPHP(message) {
  var tagsFormatted = formatTags(message);
  if (tagsFormatted === false) return;

  var header = {
    url: 'http://' + message.content.match(getSiteRegex)[1] + '/index.php?page=dapi&s=post&q=index&tags=' + tagsFormatted,
    headers: {
      'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      parseString(body, function (err, result) {
        images = result;
      });

      var index = 0;

      getImagesIndexPHP(index, images, message);

    } else {
      parseError(response, body, message);
    }
  });
  return;
}

function searchDanbooruAPI(message) {
  var tagsFormatted = formatTags(message);
  if (tagsFormatted === false) return;

  var header = {
    url: 'http://' + message.content.match(getSiteRegex)[1] + '/api/danbooru/find_posts/index.xml?tags=' + tagsFormatted,
    headers: {
      'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      parseString(body, function (err, result) {
        images = result;
      });

      var index = 0;

      getImageDanbooruAPI(index, images, message);

    } else {
      parseError(response, body, message);
    }
  });
  return;
}
/*









*/

function getImagePostsIndex(index, images, message) {
  var timeToStop = false;

  if (typeof (images[index]) != "undefined") {

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images[index].tags.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagePostsIndex(index, images, message);
      return;
    }

    if (message.content.match(getSiteRegex)[1] === 'e621.net') {
      bot.sendMessage(message.channel, images[index].file_url.toString() +
        '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString());
    } else {
      bot.sendMessage(message.channel, 'http://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString());
    }

  } else {
    bot.sendMessage(message.channel, "No images found. Try different tags. ¯\\_(ツ)_/¯");
  }
  return;
}

function getImagePostsJSON(index, images, message) {
  var timeToStop = false;

  if (typeof (images[index]) != "undefined") {

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images[index].tag_string.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagePostsJSON(index, images, message);
      return;
    }

    console.log('http://' + message.content.match(getSiteRegex)[1] + '/posts/' + images[index].id.toString());

      //danbooru embeds!
      //bot.sendMessage(message.channel, 'http://' + message.content.match(getSiteRegex)[1] + images[index].file_url.toString());
      bot.sendMessage(message.channel, 'http://' + message.content.match(getSiteRegex)[1] + '/posts/' + images[index].id.toString());
    } else {
      bot.sendMessage(message.channel, "No images found. Try different tags. ¯\\_(ツ)_/¯");
    }
    return;
}

function getImagePostJSON(index, images, message) {
  var timeToStop = false;

  if (typeof (images[index]) != "undefined") {

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images[index].tags.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagePostJSON(index, images, message);
      return;
    }

    console.log('http://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString());

    bot.sendMessage(message.channel, 'http://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString());

  } else {
    bot.sendMessage(message.channel, "No images found. Try different tags. ¯\\_(ツ)_/¯");
  }
    return;
}

function getImagesIndexPHP(index, images, message) {
  //images.posts.post[0].$;
  var timeToStop = false;
  var numResults;

  if (images.posts.post !== undefined) {
    if (images.posts.post[index] === undefined) { //lazy shitty fix ()
      bot.sendMessage(message.channel, "No images found. Try different tags. ¯\\_(ツ)_/¯");
      return;
    }

    if (images.posts.$.count < 100) {
      numResults = images.posts.$.count;
    } else {
      numResults = 100;
    }

    index = Math.floor(Math.random()*numResults); //Randomly select an image

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images.posts.post[index].$.tags.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagesIndexPHP(index, images, message);
      return;
    }

    console.log('http://' + message.content.match(getSiteRegex)[1] + '/index.php?page=post&s=view&id=' + images.posts.post[index].$.id.toString());

    if (message.content.match(getSiteRegex)[1] !== 'rule34.xxx') { //r34 you cuck
      bot.sendMessage(message.channel, images.posts.post[index].$.file_url +
        '\nhttp://' + message.content.match(getSiteRegex)[1] + '/index.php?page=post&s=view&id=' + images.posts.post[index].$.id.toString());
      } else {
        bot.sendMessage(message.channel, 'http:' + images.posts.post[index].$.file_url +
          '\nhttp://' + message.content.match(getSiteRegex)[1] + '/index.php?page=post&s=view&id=' + images.posts.post[index].$.id.toString());
      }

  } else {
    bot.sendMessage(message.channel, "No images found. Try different tags. ¯\\_(ツ)_/¯");
  }
  return;
}

function getImageDanbooruAPI(index, images, message) {
  //images.posts.post[0].$;
  var timeToStop = false;
  var numResults;

  if (images.posts.post !== undefined) {
    if (images.posts.post[index] === undefined) { //lazy shitty fix ()
      bot.sendMessage(message.channel, "No images found. Try different tags. ¯\\_(ツ)_/¯");
      return;
    }

    if (images.posts.$.count < 100) {
      numResults = images.posts.$.count;
    } else {
      numResults = 100;
    }

    index = Math.floor(Math.random()*numResults); //Randomly select an image

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images.posts.post[index].$.tags.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagesIndexPHP(index, images, message);
      return;
    }

    console.log('http://' + message.content.match(getSiteRegex)[1] + '/post/view/' + images.posts.post[index].$.id.toString());

    if (message.content.match(getSiteRegex)[1] === 'dollbooru.org') { //why can't you keep constant apis?
      bot.sendMessage(message.channel, 'http://' + message.content.match(getSiteRegex)[1] + images.posts.post[index].$.file_url +
        '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/view/' + images.posts.post[index].$.id.toString());
      } else {
        bot.sendMessage(message.channel, images.posts.post[index].$.file_url +
          '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/view/' + images.posts.post[index].$.id.toString());
      }

  } else {
    bot.sendMessage(message.channel, "No images found. Try different tags. ¯\\_(ツ)_/¯");
  }
  return;
}
/*









*/

function formatTags(message) { //pulls the tags, verifies none is blacklisted, and formats them for urls
  var tags = getTags(message.content.substring(message.content.match(getSiteRegex)[0].length + 1));

  if(containsBlacklistedTag(tags, message)) {
    return false;
  }

  var tagsFormatted = tags.join('+');

  return tagsFormatted;
}

function getTags(content) { //turns comma seperated tags into an array
  var tags = content.replace(/(\s*,\s*)/g, ',').split(','); //.filter() ;^)
  tags = tags.filter(function(e) {return e !== '';}); //clear empty values (be glad it's not a one-liner)

  return tags;
}

function containsBlacklistedTag(tags, message) { //checks if one of the tags is blacklisted
  var timeToStop = false;

  tags.forEach(function(element) {
    if (settings[serverId].blacklist.tags.indexOf(element) !== -1) {
      timeToStop = true;
      bot.sendMessage(message.channel, '`' + element + '` is in the blacklist! ***Kinkshame!***');
      return;
    }
  });

  return timeToStop;
}

/*









*/

function parseError(response, body, message) {
  if (response === undefined) {
    bot.sendMessage(message.channel, '404! That site doesn\'t exist');
  } else {
    var errorMessage = JSON.parse(body);

    console.log(errorMessage);
    if (errorMessage.sucess === undefined && errorMessage.message === undefined) {
      bot.sendMessage(message.channel, "Something is wrong with the API. Or it's my fault.");
      bot.sendMessage(message.channel, '```\n' + error + '\n```');
    } else {
      bot.sendMessage(message.channel, "Whelp, I got an error.");
      bot.sendMessage(message.channel, '```\n' + errorMessage.message + '\n```');
    }
  }

  return;
}

/*









*/

//Look, I know I could just have a function to do the logic or have one function that takes an extra param to see if it should add/remove from the blacklist
//But I already wrote this and can't be bothered to rewrite something new that might break
//P.S. this is a relic of when the bot only supported e621.net. good times
function blacklist(message) {
  console.log('blacklist');

  var split = message.content.split(' ');

  //=blacklist site safebooru.org
  //['=blacklist', 'site', 'safebooru.org']

  //=blacklist jews
  //['=blacklist', 'jews']

  //=============================

  //=blacklist all nsfw
  //Blacklists all nsfw sites

  //=blacklist all sfw
  //sfw is for the the weak

  //=blacklist all channels/sites
  //Blacklists all channels/sites

  if (split[1] === 'all') {
    var site; //\jshint bitches about it being already declared if I declare it in for()
    switch (split[2]) {
      case 'nsfw':
        for(site in sites) {
          if (sites[site].nsfw === true && settings[serverId].blacklist.sites.indexOf(site) === -1) {
            settings[serverId].blacklist.sites.push(site);
          }
        }
        bot.sendMessage(message.channel, 'Blacklisted all nsfw sites! ~~pleb~~');
      break;

      case 'sfw':
        for(site in sites) {
          if (sites[site].nsfw === false && settings[serverId].blacklist.sites.indexOf(site) === -1) {
            settings[serverId].blacklist.sites.push(site);
          }
        }
        bot.sendMessage(message.channel, 'Blacklisted all sfw sites! ~~;^)~~');
      break;

      case 'sites':
        for(site in sites) {
          if (settings[serverId].blacklist.sites.indexOf(site) === -1) {
            settings[serverId].blacklist.sites.push(site);
          }
        }
        bot.sendMessage(message.channel, 'Blacklisted all sites! ~~But that make me useless :\'(~~');
      break;

      case 'channels':
      //this took way too long to write
      var channel; //woo lazyness
        for(var i = message.channel.server.channels.length - 1; i >= 0; i--) {
          channel = message.channel.server.channels[i];
          if (!blacklistContainsChannel(channel.id) && channel.type === 'text') {
            settings[serverId].blacklist.channels.push({"id" : channel.id, "name": channel.name});
          }
        }
        bot.sendMessage(message.channel, 'Blacklisted all channels! ~~Now I can\'t do anything~~');
      break;

      case 'tags':
        bot.sendMessage(message.channel, 'Blacklisted all ta- wait. How am I supposed to know ALL the tags!?');
      break;

      default:
        bot.sendMessage(message.channel, 'Blacklist all... what?');
    }
    saveSettings();
    return;
  }

  //============================

  if (split[1] === 'site') {
    split[2] = expandSite(split[2]); //turn e6 to e621.net and so forth
  }

  if (split[1] === 'site' && sites[split[2]] === undefined) {
    bot.sendMessage(message.channel, '`' + split[2] + '` is NOT supported, so blacklisting it is useless.');
    return;
  }

  //hot mess
  if (split[1] === 'channel') {
    var chanMatch = message.content.match(getChannelRegex);
    var chanId;

    if (chanMatch !== null) {
      chanId = chanMatch[1];
    } else {
      bot.sendMessage(message.channel, 'You need to supply a channel if you want me to blacklist it...');
      return;
    }

    var chan = bot.channels.get("id", chanId);

    if (chan !== null) {
      if (!blacklistContainsChannel(chan.id)) {
        settings[serverId].blacklist.channels.push({"id": chan.id, "name": chan.name});
        bot.sendMessage(message.channel, '`#' + chan.name + '` added to blacklist. No searching for them!');
        return;
      } else {
        bot.sendMessage(message.channel, '`#' + chan.name + '` is already blacklisted!');
        return;
      }
    } else {
      bot.sendMessage(message.channel, 'That\'s not a real channel! Try mentionning one.');
      return;
    }
  }

  if (settings[serverId].blacklist[split[1] + 's'] === undefined) {
    bot.sendMessage(message.channel, '`' + split[1] + '` ain\'t a valid category. Try harder. (tag, channel, site)');
    return;
  } else {
    split[1] += 's'; //tag => tags
  }

  if (split[2] === undefined) { //see above, we default to blacklisting tags
    split[2] = split[1];
    split[1] = 'tags';
  }

  var category = split[1];
  var toAdd = split[2];

  var index = settings[serverId].blacklist[category].indexOf(toAdd);

  if (index !== -1) {
    bot.sendMessage(message.channel, '`' + toAdd + '` is already in the blacklist. Lrn 2 read.');
    return;
  }

  if (toAdd === '') {
    bot.sendMessage(message.channel, 'You want me to... Blacklist *nothing*?');
    return;
  }

  settings[serverId].blacklist[category].push(toAdd);

  saveSettings();

  bot.sendMessage(message.channel, '`' + toAdd + '` added to blacklist. Goodbye!');
}

function whitelist(message) {
  console.log('Whitelist');

  var split = message.content.split(' ');
  var index = 0; //used to splice

  //=whitelist site safebooru.org
  //['=whitelist', 'site', 'safebooru.org']

  //=whitelist jews
  //['=whitelist', 'jews']

  //=============================

  //=whitelist all nsfw
  //whitelists all nsfw sites

  //=whitelist all sfw
  //sfw is for the the weak

  //=whitelist all channels/sites
  //whitelists all channels/sites

  if (split[1] === 'all') {
    var site; //\jshint bitches about it being already declared if I declare it in for
    switch (split[2]) {
      case 'nsfw':
        for(site in sites) {
          index = settings[serverId].blacklist.sites.indexOf(site);
          if (sites[site].nsfw === true && index !== -1) {
            settings[serverId].blacklist.sites.splice(index, 1);
          }
        }
        bot.sendMessage(message.channel, 'Whitelisted all nsfw sites! We all need some lewd sometimes.');
      break;

      case 'sfw':
        for(site in sites) {
          index = settings[serverId].blacklist.sites.indexOf(site);
          if (sites[site].nsfw === false && index !== -1) {
            settings[serverId].blacklist.sites.splice(index, 1);
          }
        }
        bot.sendMessage(message.channel, 'Whitelisted all sfw sites! Because sometimes you just want art.');
      break;

      case 'sites':
        settings[serverId].blacklist.sites = []; //just empty it, it's the best and easiest way to whitelist all
        bot.sendMessage(message.channel, 'Whitelisted all sites! Goodbye censorship!');
      break;

      case 'channels':
        settings[serverId].blacklist.channels = [];
        bot.sendMessage(message.channel, 'Whitelisted all channels! Call me anywhere!');
      break;

      case 'tags':
        settings[serverId].blacklist.tags = [];
        bot.sendMessage(message.channel, 'Whitelisted all tags! Kinks ahoy!');
      break;

      default:
        bot.sendMessage(message.channel, 'Whitelist all... things? I need some more info m9.');
    }
    saveSettings();
    return;
  }

  if (split[1] === 'site') {
    split[2] = expandSite(split[2]); //turn e6 to e621.net and so forth
  }

  //hot mess
  if (split[1] === 'channel') {
    var chanMatch = message.content.match(getChannelRegex);
    var chanId;

    if (chanMatch !== null) {
      chanId = chanMatch[1];
    } else {
      bot.sendMessage(message.channel, 'You need to supply a channel if you want me to whitelist it...');
      return;
    }

    var chan = bot.channels.get("id", chanId);

    if (chan !== null) {
      if (blacklistContainsChannel(chan.id)) {
        index = blacklistContainsChannel(chan.id, true); //true makes it return the index of the match
        settings[serverId].blacklist.channels.splice(index, 1);
        bot.sendMessage(message.channel, '`#' + chan.name + '` removed from blacklist. More work for me!');
        return;
      } else {
        bot.sendMessage(message.channel, '`#' + chan.name + '` is not blacklisted m9');
        return;
      }
    } else {
      bot.sendMessage(message.channel, 'That\'s not a real channel! Try mentionning one.');
      return;
    }
  }

  if (settings[serverId].blacklist[split[1] + 's'] === undefined) {
    bot.sendMessage(message.channel, '`' + split[1] + '` ain\'t a valid category. Try harder. (tag, channel, site)');
    return;
  } else {
    split[1] += 's'; //tag => tags
  }

  if (split[2] === undefined) { //see above, we default to whitelisting tags
    split[2] = split[1];
    split[1] = 'tags';
  }

  var category = split[1];
  var toRemove = split[2];

  index = settings[serverId].blacklist[category].indexOf(toRemove);

  if (toRemove === '') {
    bot.sendMessage(message.channel, '...whitelist *what*?');
    return;
  }

  if (index !== -1) {
    settings[serverId].blacklist[category].splice(index, 1);
  } else {
    bot.sendMessage(message.channel, '`' + toRemove + '` is not in the blacklist (yet)');
    return;
  }

  saveSettings();

  bot.sendMessage(message.channel, '`' + toRemove + '` removed from blacklist, now enjoy `' + toRemove + '`');
}

function blacklistAddUser(message) {
  console.log('AddUser');

  var toAdd = message.mentions;

  if (toAdd[0] === undefined) {
    bot.sendMessage(message.channel, 'No user found! You gotta mention someone');
    return;
  }

  var index = settings[serverId].users.indexOf(toAdd[0].id);

  if (index === -1) {
    settings[serverId].users.push(toAdd[0].id);
  } else {
    bot.sendMessage(message.channel, '`' + toAdd[0].id + '` is already in the list m9');
    return;
  }

  saveSettings();

  bot.sendMessage(message.channel, 'Added `' + toAdd[0].id + '`, they can edit the blacklist now.');
}

function blacklistRemoveUser(message) {
  console.log('RemoveUser');

  var toRemove = message.mentions;

  if (toRemove[0] === undefined) {
    bot.sendMessage(message.channel, 'No user found! You could try mentionning someone, but that\'d be rude');
    return;
  }

  var index = settings[serverId].users.indexOf(toRemove[0].id);

  if (index !== -1) {
    settings[serverId].users.splice(index, 1);
  } else {
    bot.sendMessage(message.channel, '`' + toRemove[0].id + '` was never in the list in the first place');
    return;
  }

  saveSettings();

  bot.sendMessage(message.channel, '`' + toRemove[0].id + '` removed from blacklist whitelist');
}

/*









*/

//TODO: Better help
function help(message) {
  console.log('Help!');

  var helpText = 'You should never see this';
  var param = message.content.substring('=help '.length);

  if (helpDocs[param] !== undefined) {
    helpText = helpDocs[param];
  } else {
    helpText = 'I can\'t offer you help with... whatever ' +  param + ' is.';
  }

  bot.sendMessage(message.channel, helpText);
}

function changeAvy() {
  console.log('New Avy');
  var fileNames = fs.readdirSync('./avys'); //Images in a folder called "avys" in the same folder as the script
  //fileNames is an array of file names

  var fileChosen = fileNames[Math.floor(Math.random() * fileNames.length)]; //Randomly choose one

  base64.encode('./avys/' + fileChosen, {"local": true}, function(err, response) {
    if (err) {
      console.log(err + '\nError while setting avy\n');
    } else {
      bot.setAvatar(response); //Set avy
    }
  });
}

/*









*/

function saveSettings() {
  fs.writeFile('./settings.json', JSON.stringify(settings, null, 4), function(err) {
    if(err) {
      console.log(err + '\nError while saving settings\n');
    } else {
      console.log('Settings saved');
    }
  });
}

function blacklistContainsChannel(channelId, returnIndex) {
  var containsChannel = false;
  var containsIndex = -1;

  settings[serverId].blacklist.channels.forEach(function(chan, index) {
    if (chan.id === channelId) {
      containsChannel = true;
      containsIndex = index;
      return;
    }
  });
  if (returnIndex !== undefined) {
    return containsIndex;
  } else {
    return containsChannel;
  }
}

function blacklistFormatChannels() {
  var channelNames = [];
  settings[serverId].blacklist.channels.forEach(function(chan) {
    channelNames.push('#' + chan.name);
  });
  return channelNames;
}

//takes the content and expands it to the full url (if an alias exsists)
function expandSite(content) {
  var unexpandedSite = content;

  //alias support for sites, so you don't need to type all of the url ('e6' => 'e621.net')
  for(var site in sites){
    if(sites[site].aliases.indexOf(unexpandedSite) !== -1) {
      console.log('Expanding ' + unexpandedSite + ' to ' + site);
      unexpandedSite = site;
    }
  }

  return unexpandedSite; //i wrote this while tried, ok?
}

function randomSite() {
  var siteToSearch = Object.keys(sites)[Math.floor(Math.random()*Object.keys(sites).length)]; //I stopped caring that you very much
  if (settings[serverId].blacklist.sites.indexOf(siteToSearch) !== -1) {
     siteToSearch = randomSite();
  }
  return siteToSearch;
}

function canEditBlacklist(message) {
  var canEdit = false;

  //You can edit the blacklist if:
  //a) You're in the user whitelist
  //b) You have the 'manageServer' permission
  //c) You're in a dm with the bot

  //You can probably figure that out without the comments but whatever

  if (settings[serverId].users.indexOf(message.author.id) !== -1 ||
      userHasPermission(serverId, message.author, 'manageServer') || //userHasPermission returns true if in a dm
      message.author.id === Auth.ownerID) { //cheap, I know, but it's there so I can control my bot from discord (Also I can use =eval or just edit the .json file /shrug)
    canEdit = true;
  }

  return canEdit;
}

function userHasPermission(server, user, permisssion) {
  if (serverId.indexOf('dm') === 0) return true; //DMs don't need no server manager!

  var roles = server.detailsOfUser(user).roles; //Array of roles

  var hasRole = false;

  for (var roleIndex = 0; roleIndex < roles.length; roleIndex++) {
    if (roles[roleIndex].hasPermission(permisssion)) {
      hasRole = true;
    }
  }

  console.log(user.username + ' in server ' + server.name + ' has permission ' + permisssion + '? : ' + hasRole);

  return hasRole;
}

function createServerSettings(serverId) {
  if (settings[serverId] === undefined) {
    console.log('Server has no settings, creating settings for: ' + serverId);
    settings[serverId] = defaultSettings;

    fs.writeFile('./settings.json', JSON.stringify(settings, null, 4), function (err) {
      if (err) {
          console.log(err + '\n===\nError while creating settings');
      } else {
          console.log('Settings Created');
      }
    });
  }
}
/*









*/
//Login stuff

if (Auth.token !== '') {
  console.log('Logged in with token!');
  bot.loginWithToken(Auth.token);

} else if (Auth.email !== '' && Auth.password !== '') {
  bot.login(Auth.email, Auth.password, function (error, token) {
    console.log('Logged in with email + pass!');
    Auth.token = token;

    fs.writeFile('./auth.json', JSON.stringify(Auth, null, 4), function(err) {
      if(err) {
        console.log(err + '\n===\nError while saving token');
      } else {
        console.log('Token saved');
      }
    });

  });
} else {
  console.log('No authentication details found!');
  process.exit(1);
}

//Graceful exit (Like a whale)
process.stdin.resume();

process.on('SIGINT', function() {
    bot.logout();
    exitRobotOtter();
});

function exitRobotOtter() { //to lazy to change kek
    bot.logout();
    console.log('\n=-=-=-=-=-=-=-=' +
                '\nLogged out.');
    process.exit(1);
}
//Congrats! You read all of this bs!
//Or you scrolled all the way down, either way you didn't give up at the start

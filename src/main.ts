const dotenv = require('dotenv');
const { google } = require('googleapis');
const Reddit = require('reddit');

dotenv.config();

type Comment = {
  author: string,
  body: string,
  created: number,
  created_utc: number,
}

type Child = {
  data: Comment
}

const reddit = new Reddit({
  username: process.env['REDDIT_USERNAME'],
  password: process.env['REDDIT_PASSWORD'],
  appId: process.env['REDDIT_APP_ID'],
  appSecret: process.env['REDDIT_APP_SECRET'],
  userAgent: 'MyApp/1.0.0 (http://example.com)'
});

const youtube = google.youtube({
  version: 'v3',
  auth: process.env['GOOGLE_API_KEY'],
})

async function main() {
  const redditSourceThread = '/r/flammy/comments/17qn2wd';
  const youtubeLinkReg = /https:\/\/www.youtube.com[^\s\[\])(]*/g;
  const redditUsernameReg = /u\/\w+/g;


  const comments: any[] = await reddit.get(redditSourceThread);
  const [, replies] = comments;

  // TODO: Pull out youtube username or channel ID from link if possible
  const map = replies.data.children.map((child: Child)=> ({
    author: child.data.author,
    body: child.data.body,
    created: child.data.created,
    created_utc: child.data.created_utc,
    youtubeLink: child.data.body.match(youtubeLinkReg),
    redditUserName: child.data.body.match(redditUsernameReg),
  }));

  console.log('map', JSON.stringify(map, null, 2));

  // https://developers.google.com/youtube/v3/docs/channels/list
  // Can only search channel by id or forUsername
  const { data: channel } = await youtube.channels.list({
    part: ['snippet,statistics'],
    forUsername: 'flammy5',
  })

  console.log('channel', JSON.stringify(channel, null, 2));
}

main().catch(e => {
  console.error(e);
  throw e;
})
import dotenv from 'dotenv';
import {google, youtube_v3} from 'googleapis';
import Reddit from 'reddit';
import moment, {Moment} from 'moment';
import { formatNumber } from './util';
import {RedditChild, Comment, Verification} from './types'

dotenv.config();

const SUBREDDIT = process.env['SUBREDDIT'] as string;
const ARTICLE = process.env['SUBREDDIT_ARTICLE'] as string;
const PREVIOUS_DAYS = process.env['PREVIOUS_DAYS'] as string;

const reddit = new Reddit({
  username: process.env['REDDIT_USERNAME'] as string,
  password: process.env['REDDIT_PASSWORD'] as string,
  appId: process.env['REDDIT_APP_ID'] as string,
  appSecret: process.env['REDDIT_APP_SECRET'] as string,
  userAgent: 'MyApp/1.0.0 (http://example.com)'
});

const youtube = google.youtube({
  version: 'v3',
  auth: process.env['GOOGLE_API_KEY'],
});

/**
 * Returns list of top level comments from a Reddit Post (Article)
 * Removes comments without youtubeLinks and comments created within a date range
 * @param articleSource
 */
const getRedditComments = async (articleSource: string, startDate: Moment)=> {
  const youtubeLinkReg = /https:\/\/www.youtube.com[^\s\[\])(]*/;
  const redditUsernameReg = /u\/\w+/;
  const redditArticle: any[] = await reddit.get(articleSource);
  const [, replies] = redditArticle;

  const comments: Comment[] = replies.data.children.map((child: RedditChild)=> ({
    author: child.data.author,
    body: child.data.body,
    created: child.data.created,
    created_utc: child.data.created_utc,
    youtubeLink: child.data.body.match(youtubeLinkReg),
    redditUserName: child.data.body.match(redditUsernameReg), // TODO: possibly no required
  })).filter((item: Comment) => {
    const commentCreated = moment.unix(item.created).utc()
    const now = moment.utc();
    const previous = moment.utc().subtract(PREVIOUS_DAYS, 'days');
    return item.youtubeLink?.length && commentCreated.isBetween(previous, now);
  });

  return comments;
}

/**
 * Looks up a YouTube Channel and validates if Channel is owned by the Reddit author
 * https://developers.google.com/youtube/v3/docs/channels/list
 * @param comment
 */
const verifyChannel = async (comment: Comment): Promise<Verification | null> => {
  const usernameReg = new RegExp(`u/${comment.author}`, 'i');
  const youtubeChannelListParams: youtube_v3.Params$Resource$Channels$List = {
    part: ['snippet,statistics'],
  }
  const [, slug]= comment.youtubeLink[0].split('https://www.youtube.com/');

  if (slug.includes('user/')) {
    youtubeChannelListParams.forUsername = slug.split('user/')[1];
  } else if (slug.includes('u/')) {
    youtubeChannelListParams.forUsername = slug.split('u/')[1];
  } else if (slug.includes('c/')) {
    youtubeChannelListParams.id = [slug.split('c/')[1]];
  } else if (slug.includes('channel/')) {
    youtubeChannelListParams.id = [slug.split('channel/')[1]];
  } else {
    youtubeChannelListParams.forUsername = slug;
  }

  const { data: channel } = await youtube.channels.list(youtubeChannelListParams);

  if (channel.items) {
    const { snippet, statistics } = channel.items[0];

    if (snippet?.description && statistics) {
      if (usernameReg.test(snippet.description)) {
        console.log(`USER: ${comment.author} is verified`);
        return {
          reddit: {
            comment
          },
          youtube: {
            snippet,
            statistics
          }
        }
      } else {
        console.log(`USER: ${comment.author} is NOT verified`);
        return null;
      }
    }
    return null;
  } else {
    console.log(`NO CHANNEL FOUND for ${comment.author}`);
    return null;
  }
}

/**
 * Sets the flair a specified Reddit author with their subscriberCount and viewCount
 * https://www.reddit.com/dev/api
 * @param verification
 */
const setFlair = async (verification: Verification) => {
  // POST [/r/subreddit]/api/selectflair
  // POST [/r/subreddit]/api/flaircsv

  const { author, youtubeLink } = verification.reddit.comment;
  const { statistics } = verification.youtube;

  if (statistics?.subscriberCount && statistics.viewCount) {
    await reddit.post(`${SUBREDDIT}/api/selectflair`, {
      name: author,
      text: `Subs: ${formatNumber(+statistics?.subscriberCount)} Views: ${formatNumber(+statistics?.viewCount)}`,
    });
  }
}

async function main() {
  const startDate = moment.utc().subtract(PREVIOUS_DAYS, 'days');
  const comments = await getRedditComments(`${SUBREDDIT}/comments/${ARTICLE}`, startDate);

  if (comments.length === 0) {
    console.log(`No new valid comments since ${startDate}`, );
  } else {
    console.log(`Reviewing ${comments.length} comments since ${startDate}`)
  }

  for (let i = 0; i < comments.length; i++) {
    const verification = await verifyChannel(comments[i]);

    if (verification) {
      await setFlair(verification);
    }
  }
}

main().catch(e => {
  console.error(e);
  throw e;
})

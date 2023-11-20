import dotenv from "dotenv";
import { google, youtube_v3 } from "googleapis";
import Reddit from "reddit";
import moment, { Moment } from "moment";
import { formatNumber, formatYoutubeLink } from "./util";
import { RedditChild, Comment, Verification } from "./types";
import { logger } from "./logger";

dotenv.config();

const SUBREDDIT = process.env["SUBREDDIT"] as string;
const ARTICLE = process.env["SUBREDDIT_ARTICLE"] as string;
const PREVIOUS_DAYS = process.env["PREVIOUS_DAYS"] as string;
const FIRST_TIER_FLAIR_ID = process.env["FIRST_TIER_FLAIR_TEMPLATE_ID"];
const FIRST_TIER_EMOJI_ID = process.env["FIRST_TIER_FLAIR_EMOJI_ID"];
const SECOND_TIER_FLAIR_ID = process.env["SECOND_TIER_FLAIR_TEMPLATE_ID"];
const SECOND_TIER_EMOJI_ID = process.env["SECOND_TIER_FLAIR_EMOJI_ID"];
const MINIMUM_SUB_COUNT = process.env["MINIMUM_SUB_COUNT"] || 100000;
const MINIMUM_VIEW_COUNT = process.env["MINIMUM_VIEW_COUNT"] || 1000000;
let flairEmojiId = '' as string 


const reddit = new Reddit({
  username: process.env["REDDIT_USERNAME"] as string,
  password: process.env["REDDIT_PASSWORD"] as string,
  appId: process.env["REDDIT_APP_ID"] as string,
  appSecret: process.env["REDDIT_APP_SECRET"] as string,
  userAgent: "MyApp/1.0.0 (http://example.com)",
});

const youtube = google.youtube({
  version: "v3",
  auth: process.env["GOOGLE_API_KEY"],
});

/**
 * Returns list of top level comments from a Reddit Post (Article)
 * Filters comments that includes YouTube links and created within a date range
 * @param articleSource
 * @param startDate
 */
const getRedditComments = async (articleSource: string, startDate: Moment) => {
  const youtubeLinkReg = /https:\/\/www.youtube.com[^\s\[\])(]*/;
  const redditArticle: any[] = await reddit.get(articleSource);
  const [, replies] = redditArticle;

  const comments: Comment[] = replies.data.children
    .map((child: RedditChild) => ({
      author: child.data.author,
      body: child.data.body,
      created: child.data.created,
      created_utc: child.data.created_utc,
      youtubeLink: child.data.body.match(youtubeLinkReg),
    }))
    .filter((item: Comment) => {
      const commentCreated = moment.unix(item.created).utc();
      const now = moment.utc();
      return (
        item.youtubeLink?.length && commentCreated.isBetween(startDate, now)
      );
    });

  return comments;
};

/**
 * Looks up a YouTube Channel and validates if Channel is owned by the Reddit author
 * https://developers.google.com/youtube/v3/docs/channels/list
 * @param comment
 */
const verifyChannel = async (
  comment: Comment
): Promise<Verification | undefined> => {
  const usernameReg = new RegExp(`/[uUrR]/${comment.author}`, "i"); // Updated regular expression pattern. Match if user users /u/username or /U/username or /r/username or /R/username 
  const youtubeChannelListParams: youtube_v3.Params$Resource$Channels$List = {
    part: ["snippet,statistics"],
  };
  const formattedYoutubeLink = formatYoutubeLink(comment.youtubeLink[0]);
  const [, slug] = formattedYoutubeLink.split("https://www.youtube.com/");

  logger.info(`Verifying /u/${comment.author} at ${formattedYoutubeLink}`);

  if (slug.includes("user/")) {
    youtubeChannelListParams.forUsername = slug.split("user/")[1];
  } else if (slug.includes("channel/")) {
    youtubeChannelListParams.id = [slug.split("channel/")[1]];
  } else {
    youtubeChannelListParams.forUsername = slug;
  }

  const { data: channel } = await youtube.channels.list(
    youtubeChannelListParams
  );
  /* Debug: Look at channel response params  */
  if (comment.author ='Flammy'){logger.debug(youtubeChannelListParams)}   // ### Broken and not working ### 
  /* end debug */ 

  if (channel.items) {
    const { snippet, statistics } = channel.items[0];

    if (snippet?.description && statistics) {
      if (usernameReg.test(snippet.description)) {
        logger.info(`/u/${comment.author} is verified`);
        return {
          reddit: {
            comment,
          },
          youtube: {
            snippet,
            statistics,
          },
        };
      } else {
        logger.warn(`/u/${comment.author} is NOT verified`);
      }
    }
  } else {
    logger.error(`CHANNEL NOT FOUND`);
  }

  
};

/**
 * Sets the flair on a specified Reddit author with their subscriberCount and viewCount
 * Applies flair template based on sub and viewer count
 * Build the flair string to conditionally include the YouTube account name in the flair
 * https://www.reddit.com/dev/api
 * @param verification
 */
const setFlair = async (verification: Verification) => {
  const { author } = verification.reddit.comment;
  const { statistics } = verification.youtube;
  logger.info(`Setting flair for /u/${author}`);

  // Build the flair for this user 
  let subCount = 0;
  let viewCount = 0;
  let flairTemplateId = '';
  if (statistics?.subscriberCount && statistics.viewCount) {
    subCount = +statistics.subscriberCount;
    viewCount = +statistics.viewCount;
    const flairTemplateId =
    subCount >= +MINIMUM_SUB_COUNT || viewCount >= +MINIMUM_VIEW_COUNT
      ? FIRST_TIER_FLAIR_ID || 'defaultFirstTierFlairId'
      : SECOND_TIER_FLAIR_ID || 'defaultSecondTierFlairId';
  flairEmojiId =
    subCount >= +MINIMUM_SUB_COUNT || viewCount >= +MINIMUM_VIEW_COUNT
      ? FIRST_TIER_EMOJI_ID || 'defaultFirstTierEmojiId'
      : SECOND_TIER_EMOJI_ID || 'defaultSecondTierEmojiId';
  }
  // Check if the comment contains the "INCLUDE" variable
  const includeYouTubeName = verification.reddit.comment.body.includes("INCLUDE");

  // Construct the flair text based on whether the "INCLUDE" variable is present
  let flairText = `:${flairEmojiId}:`;
  if (includeYouTubeName) {
    flairText += ` Channel: ${author}`;
  }
  flairText += ` Subs: ${formatNumber(subCount)} Views: ${formatNumber(viewCount)}`;

   // Truncate the username if the total flair length is longer than 64 characters
   if (flairText.length > 64) {
    const channelText = includeYouTubeName ? `Channel: ${author}` : "";
    const remainingSpace = 64 - channelText.length - 10; // 10 is the length of ": Subs: "
    const truncatedSubCount = includeYouTubeName ? formatNumber(subCount).toString().slice(0, remainingSpace) : formatNumber(subCount);
    flairText = `${channelText} Subs: ${truncatedSubCount}... Views: ${formatNumber(viewCount)}`;
  }


  // Set the flair on Reddit
  await reddit.post(`${SUBREDDIT}/api/selectflair`, {
    name: author,
    text: flairText,
    flair_template_id: flairTemplateId,
  });
};

async function main() {
  logger.info("Starting script");
  const startDate = moment.utc().subtract(PREVIOUS_DAYS, "days");
  logger.info(`Retrieving comments from https://www.reddit.com${SUBREDDIT}/comments/${ARTICLE}`);
  const comments = await getRedditComments(`${SUBREDDIT}/comments/${ARTICLE}`, startDate);
  if (comments.length === 0) {
    logger.info(`No new valid comments since ${startDate}`);
  } else {
    logger.info(`Reviewing ${comments.length} comments since ${startDate}`);
  }
  for (let i = 0; i < comments.length; i++) {
    const verification = await verifyChannel(comments[i]);
    if (verification) {
      await setFlair(verification);
    }
  }
  logger.info("Script complete");
}


main().catch((e) => {
  logger.fatal(e);
  throw e;
});

import { youtube_v3 } from "googleapis";

export type RedditComment = {
  author: string;
  body: string;
  created: number;
  created_utc: number;
}

export type RedditChild = {
  data: Comment;
}

export interface Comment extends RedditComment {
  youtubeLink: string;
  redditUsername: string;
}

export type Verification = {
  reddit: {
    comment: Comment;
  };
  youtube: {
    snippet: youtube_v3.Schema$ChannelSnippet;
    statistics: youtube_v3.Schema$ChannelStatistics;
  };
}


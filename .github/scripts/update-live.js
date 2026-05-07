const fs = require('fs');
const path = require('path');
const https = require('https');

const ACTION = process.env.ACTION;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCSTsZCHEEus5W4-18U7Haww';
const CHANNEL_HANDLE = 'TeamRoseheartGG';

function fetchUrl(url, followRedirects = false) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (followRedirects && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data, finalUrl: u }));
      }).on('error', reject);
    };
    get(url);
  });
}

async function getLiveIdFromChannelPage() {
  // YouTube's /live URL redirects to the active livestream if one exists
  const url = `https://www.youtube.com/@${CHANNEL_HANDLE}/live`;
  console.log(`Checking channel live page: ${url}`);
  const { body } = await fetchUrl(url, true);

  // Extract video ID from canonical URL or og:url in the page
  const match = body.match(/(?:\/watch\?v=|\/live\/)([a-zA-Z0-9_-]{11})/);
  if (match) {
    const videoId = match[1];
    console.log(`Found video ID from live page: ${videoId}`);
    return videoId;
  }

  console.log('No video ID found on live page.');
  return null;
}

async function isVideoCurrentlyLive(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  const { body } = await fetchUrl(url);
  const data = JSON.parse(body);

  if (!data.items || !data.items.length) return false;

  const details = data.items[0].liveStreamingDetails;
  const title = data.items[0].snippet.title;
  const live = details && details.actualStartTime && !details.actualEndTime;
  if (live) console.log(`Confirmed live: "${title}"`);
  return live ? videoId : false;
}

async function getRecentVideoIds() {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
  console.log('Fetching RSS feed...');
  const { body } = await fetchUrl(url);
  const matches = [...body.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)];
  return matches.map(m => m[1]);
}

async function findLiveVideoId(videoIds) {
  const ids = videoIds.slice(0, 5).join(',');
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${ids}&key=${YOUTUBE_API_KEY}`;
  const { body } = await fetchUrl(url);
  const data = JSON.parse(body);

  if (!data.items) return null;

  for (const item of data.items) {
    const details = item.liveStreamingDetails;
    if (details && details.actualStartTime && !details.actualEndTime) {
      console.log(`✅ Found live stream: ${item.id} ("${item.snippet.title}")`);
      return item.id;
    }
  }
  return null;
}

function updateStreamJson(videoId) {
  const filePath = path.join(__dirname, '../../live/stream.json');
  const content = JSON.stringify({ youtubeVideoId: videoId }, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated live/stream.json → "${videoId}"`);
}

async function main() {
  console.log(`Action: ${ACTION}`);

  if (ACTION === 'go_offline') {
    updateStreamJson('');
    console.log('✅ Stream set to offline');
    return;
  }

  if (!YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY not set in environment variables');
    process.exit(1);
  }

  let liveId = null;

  // Step 1: check the channel /live page first — most reliable
  const candidateId = await getLiveIdFromChannelPage();
  if (candidateId) {
    liveId = await isVideoCurrentlyLive(candidateId);
  }

  // Step 2: fall back to RSS + API if live page didn't work
  if (!liveId) {
    console.log('Falling back to RSS feed check...');
    const videoIds = await getRecentVideoIds();
    if (videoIds.length) {
      liveId = await findLiveVideoId(videoIds);
    }
  }

  if (ACTION === 'go_live') {
    if (liveId) {
      updateStreamJson(liveId);
      console.log('✅ Stream set to live');
    } else {
      console.log('❌ No live stream found');
    }
  } else if (ACTION === 'check') {
    console.log(liveId ? `✅ Live video ID: ${liveId}` : '❌ No live stream');
  } else {
    console.error(`Unknown action: ${ACTION}`);
    process.exit(1);
  }
}

main();
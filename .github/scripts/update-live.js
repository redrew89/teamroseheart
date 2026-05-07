const fs = require('fs');
const path = require('path');
const https = require('https');

const ACTION = process.env.ACTION;
const CHANNEL_ID = 'UCSTsZCHEEus5W4-18U7Haww';

// No API key needed. No quota. Just works.

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function getRecentVideoIds() {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
  console.log('Fetching RSS feed...');
  const xml = await fetchUrl(url);

  // Pull out video IDs from <yt:videoId> tags
  const matches = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)];
  const ids = matches.map(m => m[1]);
  console.log(`Found ${ids.length} recent videos in feed.`);
  return ids;
}

async function isVideoLive(videoId) {
  // oEmbed returns basic metadata with no API key required
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  try {
    const json = await fetchUrl(url);
    const data = JSON.parse(json);
    // If the title contains "live" or we just check via a second method below
    // Primary: use the /live URL redirect trick — YouTube returns 200 for an active live stream
    return await checkLiveRedirect(videoId);
  } catch {
    return false;
  }
}

async function checkLiveRedirect(videoId) {
  // YouTube's /live page for a video redirects and returns metadata we can inspect
  // Simpler: check if the video is currently live via the nocookie embed page
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const html = await fetchUrl(url);
    // YouTube embeds "isLiveBroadcast" and liveBroadcastDetails in the page HTML
    const isLive = html.includes('"isLiveContent":true') && html.includes('"isLiveBroadcast":true');
    return isLive;
  } catch {
    return false;
  }
}

async function getLiveVideoId() {
  const videoIds = await getRecentVideoIds();
  if (!videoIds.length) {
    console.log('No videos found in RSS feed.');
    return null;
  }

  // Check the 5 most recent videos for a live stream
  for (const videoId of videoIds.slice(0, 5)) {
    console.log(`Checking if ${videoId} is live...`);
    const live = await checkLiveRedirect(videoId);
    if (live) {
      console.log(`✅ Found live stream: ${videoId}`);
      return videoId;
    }
  }

  console.log('No live stream found among recent videos.');
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

  if (ACTION === 'go_live') {
    const videoId = await getLiveVideoId();
    if (videoId) {
      updateStreamJson(videoId);
      console.log('✅ Stream set to live');
    } else {
      console.log('❌ No live stream found');
    }
  } else if (ACTION === 'go_offline') {
    updateStreamJson('');
    console.log('✅ Stream set to offline');
  } else if (ACTION === 'check') {
    const videoId = await getLiveVideoId();
    console.log(videoId ? `✅ Live video ID: ${videoId}` : '❌ No live stream');
  } else {
    console.error(`Unknown action: ${ACTION}`);
    process.exit(1);
  }
}

main();

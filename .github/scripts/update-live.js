const fs = require('fs');
const path = require('path');
const https = require('https');

const ACTION = process.env.ACTION;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCSTsZCHEEus5W4-18U7Haww';

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
  const matches = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)];
  const ids = matches.map(m => m[1]);
  console.log(`Found ${ids.length} recent videos in feed.`);
  return ids;
}

async function findLiveVideoId(videoIds) {
  // Batch up to 5 IDs in one API call — liveStreamingDetails only populates for live/scheduled videos
  const ids = videoIds.slice(0, 5).join(',');
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${ids}&key=${YOUTUBE_API_KEY}`;

  console.log(`Checking live status for ${videoIds.slice(0, 5).length} videos...`);
  const json = await fetchUrl(url);
  const data = JSON.parse(json);

  if (!data.items || !data.items.length) {
    console.log('No video data returned from API.');
    return null;
  }

  for (const item of data.items) {
    const details = item.liveStreamingDetails;
    // actualStartTime set + no actualEndTime = currently live
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

  const videoIds = await getRecentVideoIds();
  if (!videoIds.length) {
    console.log('No videos found in RSS feed.');
    return;
  }

  const liveId = await findLiveVideoId(videoIds);

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
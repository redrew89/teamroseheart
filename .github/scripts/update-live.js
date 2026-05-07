const fs = require('fs');
const path = require('path');
const https = require('https');

const ACTION = process.env.ACTION;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCSTsZCHEEus5W4-18U7Haww';
const CHANNEL_HANDLE = 'TeamRoseheartGG';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    };
    get(url);
  });
}

async function getLiveIdFromChannelPage() {
  const url = `https://www.youtube.com/@${CHANNEL_HANDLE}/live`;
  console.log(`Checking channel live page...`);
  const body = await fetchUrl(url);
  const match = body.match(/(?:\/watch\?v=|\/live\/)([a-zA-Z0-9_-]{11})/);
  if (match) {
    console.log(`Found candidate video ID: ${match[1]}`);
    return match[1];
  }
  console.log('No video ID found on live page.');
  return null;
}

async function confirmVideoIsLive(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  const body = await fetchUrl(url);
  const data = JSON.parse(body);

  if (!data.items || !data.items.length) {
    console.log('API returned no data for video.');
    return false;
  }

  const item = data.items[0];
  const details = item.liveStreamingDetails;
  const isLive = !!(details && details.actualStartTime && !details.actualEndTime);
  if (isLive) {
    console.log(`✅ Confirmed live: "${item.snippet.title}"`);
  } else {
    console.log(`Video ${videoId} is not currently live.`);
  }
  return isLive;
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

  const candidateId = await getLiveIdFromChannelPage();
  if (candidateId) {
    const confirmed = await confirmVideoIsLive(candidateId);
    if (confirmed) {
      liveId = candidateId;
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
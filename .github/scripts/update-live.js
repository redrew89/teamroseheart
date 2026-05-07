const fs = require('fs');
const path = require('path');
const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const ACTION = process.env.ACTION;
const CHANNEL_ID = 'UCSTsZCHEEus5W4-18U7Haww'; // Your channel ID

async function getLiveVideoId() {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId: CHANNEL_ID,
        eventType: 'live',
        type: 'video',
        maxResults: 1,
        key: YOUTUBE_API_KEY,
      },
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].id.videoId;
    }
  } catch (error) {
    console.error('Error fetching live video ID:', error.message);
  }
  return null;
}

function updateConfig(videoId) {
  const filePath = path.join(__dirname, '../../live/index.html');
  let content = fs.readFileSync(filePath, 'utf8');

  // Update youtubeVideoId in CONFIG
  const videoIdRegex = /youtubeVideoId:\s*'[^']*'/;
  const replacement = `youtubeVideoId: '${videoId}'`;
  content = content.replace(videoIdRegex, replacement);

  fs.writeFileSync(filePath, content);
  console.log(`Updated youtubeVideoId to: ${videoId}`);
}

async function main() {
  if (!YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY not set');
    process.exit(1);
  }

  if (ACTION === 'go_live') {
    const videoId = await getLiveVideoId();
    if (videoId) {
      updateConfig(videoId);
      console.log('Stream set to live');
    } else {
      console.log('No live stream found');
    }
  } else if (ACTION === 'go_offline') {
    updateConfig('');
    console.log('Stream set to offline');
  } else if (ACTION === 'check') {
    const videoId = await getLiveVideoId();
    console.log(videoId ? `Live video ID: ${videoId}` : 'No live stream');
  }
}

main();
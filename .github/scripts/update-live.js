const fs = require('fs');
const path = require('path');
const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const ACTION = process.env.ACTION;
const CHANNEL_ID = 'UCSTsZCHEEus5W4-18U7Haww'; // Your channel ID

// NOTE: This script runs in GitHub Actions / Node.js, so the API key must be valid for server-side requests.
// HTTP referrer restrictions are not compatible with server-side use, which causes the "Requests from referer <empty> are blocked" error.

async function getLiveVideoId() {
  try {
    console.log(`Searching for live streams on channel ${CHANNEL_ID}...`);
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

    console.log(`YouTube API response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.data.items && response.data.items.length > 0) {
      const videoId = response.data.items[0].id.videoId;
      console.log(`Found live video: ${videoId}`);
      return videoId;
    } else {
      console.log('No live videos found');
      return null;
    }
  } catch (error) {
    console.error('Error fetching live video ID:', error.message);
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response.data, null, 2));
      if (
        error.response.status === 403 &&
        error.response.data?.error?.details?.some(
          (detail) => detail.reason === 'API_KEY_HTTP_REFERRER_BLOCKED'
        )
      ) {
        console.error(
          'This request is being made from a server environment with an API key restricted to HTTP referrers. ' +
          'Use a server-side API key without referrer restrictions, or adjust the key restrictions in the Google Cloud Console.'
        );
      }
    }
    return null;
  }
}

function updateStreamJson(videoId) {
  const filePath = path.join(__dirname, '../../live/stream.json');
  const content = JSON.stringify({ youtubeVideoId: videoId }, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated live/stream.json to: ${videoId}`);
}

async function main() {
  console.log(`Action: ${ACTION}`);
  console.log(`API Key present: ${YOUTUBE_API_KEY ? 'Yes' : 'NO - THIS IS THE PROBLEM'}`);

  if (!YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY not set in environment variables');
    process.exit(1);
  }

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
  }
}

main();
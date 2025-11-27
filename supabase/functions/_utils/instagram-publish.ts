const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

interface PublishResult {
  success: boolean;
  mediaId?: string;
  mediaUrl?: string;
  error?: string;
}

export async function publishToInstagram(
  igAccountId: string,
  accessToken: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  caption?: string,
  hashtags?: string
): Promise<PublishResult> {
  try {
    console.log(`[IG-PUBLISH] Starting ${mediaType} publish to IG account ${igAccountId}`);

    const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n');

    if (mediaType === 'image') {
      return await publishImage(igAccountId, accessToken, mediaUrl, fullCaption);
    } else {
      return await publishVideo(igAccountId, accessToken, mediaUrl, fullCaption);
    }
  } catch (error) {
    console.error('[IG-PUBLISH] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function publishImage(
  igAccountId: string,
  accessToken: string,
  imageUrl: string,
  caption?: string
): Promise<PublishResult> {
  console.log('[IG-PUBLISH] Creating image container');

  // Step 1: Create image container
  const containerUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igAccountId}/media`;
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption: caption || '',
    access_token: accessToken
  });

  const containerResponse = await fetch(`${containerUrl}?${containerParams}`, {
    method: 'POST'
  });

  const containerData = await containerResponse.json();

  if (containerData.error) {
    console.error('[IG-PUBLISH] Container creation error:', containerData.error);
    throw new Error(containerData.error.message);
  }

  const containerId = containerData.id;
  console.log('[IG-PUBLISH] Image container created:', containerId);

  // Step 2: Publish container
  return await publishContainer(igAccountId, accessToken, containerId);
}

async function publishVideo(
  igAccountId: string,
  accessToken: string,
  videoUrl: string,
  caption?: string
): Promise<PublishResult> {
  console.log('[IG-PUBLISH] Creating video container');

  // Step 1: Create video container
  const containerUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igAccountId}/media`;
  const containerParams = new URLSearchParams({
    media_type: 'VIDEO',
    video_url: videoUrl,
    caption: caption || '',
    access_token: accessToken
  });

  const containerResponse = await fetch(`${containerUrl}?${containerParams}`, {
    method: 'POST'
  });

  const containerData = await containerResponse.json();

  if (containerData.error) {
    console.error('[IG-PUBLISH] Video container creation error:', containerData.error);
    throw new Error(containerData.error.message);
  }

  const containerId = containerData.id;
  console.log('[IG-PUBLISH] Video container created:', containerId);

  // Step 2: Wait for video processing
  const isReady = await waitForVideoProcessing(igAccountId, accessToken, containerId);

  if (!isReady) {
    throw new Error('Video processing timeout or failed');
  }

  // Step 3: Publish container
  return await publishContainer(igAccountId, accessToken, containerId);
}

async function waitForVideoProcessing(
  igAccountId: string,
  accessToken: string,
  containerId: string,
  maxAttempts = 30
): Promise<boolean> {
  console.log('[IG-PUBLISH] Waiting for video processing');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${accessToken}`;
    const statusResponse = await fetch(statusUrl);
    const statusData = await statusResponse.json();

    console.log(`[IG-PUBLISH] Video status check ${attempt + 1}/${maxAttempts}:`, statusData.status_code);

    if (statusData.status_code === 'FINISHED') {
      console.log('[IG-PUBLISH] Video processing complete');
      return true;
    }

    if (statusData.status_code === 'ERROR') {
      console.error('[IG-PUBLISH] Video processing failed');
      return false;
    }

    // Wait 10 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.error('[IG-PUBLISH] Video processing timeout');
  return false;
}

async function publishContainer(
  igAccountId: string,
  accessToken: string,
  containerId: string
): Promise<PublishResult> {
  console.log('[IG-PUBLISH] Publishing container:', containerId);

  const publishUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igAccountId}/media_publish`;
  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken
  });

  const publishResponse = await fetch(`${publishUrl}?${publishParams}`, {
    method: 'POST'
  });

  const publishData = await publishResponse.json();

  if (publishData.error) {
    console.error('[IG-PUBLISH] Publish error:', publishData.error);
    throw new Error(publishData.error.message);
  }

  const mediaId = publishData.id;
  console.log('[IG-PUBLISH] Successfully published media:', mediaId);

  // Get media permalink
  const permalinkUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}?fields=permalink&access_token=${accessToken}`;
  const permalinkResponse = await fetch(permalinkUrl);
  const permalinkData = await permalinkResponse.json();

  return {
    success: true,
    mediaId,
    mediaUrl: permalinkData.permalink
  };
}

export async function publishToFacebook(
  pageId: string,
  accessToken: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  caption?: string,
  hashtags?: string
): Promise<PublishResult> {
  try {
    console.log(`[FB-PUBLISH] Starting ${mediaType} publish to page ${pageId}`);

    const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n');
    const publishUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/${mediaType === 'video' ? 'videos' : 'photos'}`;

    const params = new URLSearchParams({
      message: fullCaption || '',
      access_token: accessToken
    });

    if (mediaType === 'image') {
      params.append('url', mediaUrl);
    } else {
      params.append('file_url', mediaUrl);
    }

    const response = await fetch(`${publishUrl}?${params}`, {
      method: 'POST'
    });

    const data = await response.json();

    if (data.error) {
      console.error('[FB-PUBLISH] Publish error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('[FB-PUBLISH] Successfully published:', data.id);

    // Construct Facebook post URL
    const postUrl = `https://www.facebook.com/${pageId}/posts/${data.id}`;

    return {
      success: true,
      mediaId: data.id,
      mediaUrl: postUrl
    };
  } catch (error) {
    console.error('[FB-PUBLISH] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

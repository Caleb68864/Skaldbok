---
scenario_id: "EC-05"
title: "Image Resize Validation"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-05: Image Resize Validation

## Description
Verifies that attaching a large image (>1920px wide) triggers the resizeAndCompress utility, producing a resized image at most 1920px wide with JPEG compression at quality 0.8, resulting in a reasonable file size (~200-500KB).

## Preconditions
- App is running at localhost

## Steps
1. Navigate to the app root (`/`).
2. Use `browser_evaluate` to test the resizeAndCompress function directly with a large synthetic image:
   ```js
   // Create a 4000x3000 canvas to simulate a large photo
   const canvas = document.createElement('canvas');
   canvas.width = 4000;
   canvas.height = 3000;
   const ctx = canvas.getContext('2d');
   // Draw gradient pattern to give it realistic-ish entropy
   const grad = ctx.createLinearGradient(0, 0, 4000, 3000);
   grad.addColorStop(0, '#ff0000');
   grad.addColorStop(0.5, '#00ff00');
   grad.addColorStop(1, '#0000ff');
   ctx.fillStyle = grad;
   ctx.fillRect(0, 0, 4000, 3000);
   // Add some text for texture
   ctx.fillStyle = 'white';
   ctx.font = '48px sans-serif';
   ctx.fillText('Large Test Image', 100, 200);

   const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
   const file = new File([blob], 'large-photo.png', { type: 'image/png' });

   const { resizeAndCompress } = await import('/src/utils/imageResize');
   const result = await resizeAndCompress(file);

   // Check dimensions of result
   const bitmap = await createImageBitmap(result);
   return JSON.stringify({
     originalWidth: 4000,
     originalHeight: 3000,
     resultWidth: bitmap.width,
     resultHeight: bitmap.height,
     resultSizeBytes: result.size,
     resultType: result.type,
   });
   ```
3. Verify resultWidth is exactly 1920 (scaled down from 4000).
4. Verify resultHeight is 1440 (proportionally scaled: 3000 * (1920/4000)).
5. Verify resultType is 'image/jpeg'.
6. Verify resultSizeBytes is reasonable (less than the original, typically 50KB-500KB for a gradient image).
7. Test with an image already under 1920px:
   ```js
   const canvas = document.createElement('canvas');
   canvas.width = 800;
   canvas.height = 600;
   const ctx = canvas.getContext('2d');
   ctx.fillStyle = '#333';
   ctx.fillRect(0, 0, 800, 600);
   const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
   const file = new File([blob], 'small-photo.png', { type: 'image/png' });
   const { resizeAndCompress } = await import('/src/utils/imageResize');
   const result = await resizeAndCompress(file);
   const bitmap = await createImageBitmap(result);
   return JSON.stringify({ resultWidth: bitmap.width, resultHeight: bitmap.height });
   ```
8. Verify the small image keeps its original dimensions (800x600, not upscaled).

## Expected Results
- Images >1920px wide are resized to exactly 1920px width with proportional height.
- Images <=1920px wide are NOT upscaled.
- Output format is JPEG with quality 0.8.
- Compressed file size is significantly smaller than the raw canvas data.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Large image resized to 1920px wide; small image unchanged; output is JPEG; size is reasonable.
- **Fail:** Image not resized, upscaled, wrong format, or excessively large output.

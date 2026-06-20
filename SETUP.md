# Optic Privacy Guard - Setup & Installation

## Quick Start

### 1. Load the Extension into Chrome/Edge

1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repository
5. The extension will appear in your extensions list

### 2. Grant Permissions

1. Click the Optic Privacy Guard extension icon
2. Click **Request page access** to allow the extension to scan web pages
3. Confirm the permission prompt

### 3. Link Your Instagram Account (Optional)

1. Click the extension icon
2. Enter your Instagram handle (e.g., `@yourhandle`)
3. Click **Link Instagram Account**
4. This will open your Instagram profile and save your handle for reference

## Testing on Instagram

### ✅ What Works

The extension will scan:
- **Posts** on your feed and profile
- **Captions** and visual content
- **Comments** (including phishing indicators)
- **Images/videos** for metadata and privacy clues

### ⚠️ Limitations

- **Instagram's anti-scraping**: Instagram aggressively blocks DOM access. Some captions and comments may not be detected if Instagram's JS obfuscation prevents access.
- **Dynamically loaded content**: Posts that load via infinite scroll may not be scanned until the extension's timer picks them up (every 4.5 seconds).
- **Stories & Reels**: Limited support due to different DOM structures.
- **Private messages**: The extension cannot access direct messages for privacy reasons. Only public comments and posts are scanned.

## Features

### 1. Post Scanning
The extension detects:
- **Location leaks** (NYC, specific cities, venues)
- **Routine patterns** ("daily coffee time")
- **Brand/item exposure** (bag brands, nails, phone cases)
- **Time indicators** (clocks, timestamps)
- **Store branding** (Starbucks, Dunkin, local cafes)

### 2. Comment Analysis
Identifies:
- **Social context leaks** ("moved to NYC, miss you")
- **Personal transitions** (recent moves, adjustments)
- **Phishing signals** (scam-like language patterns)

### 3. Phishing Detection
Flags messages that contain:
- Personalized location details from your posts
- Requests for money/help
- Suspicious links
- AI-generated scam patterns

Example: "hey saw you were in nyc and was wondering if you could help out with my rent. please click the link"

## Configuration

### Popup Settings

| Setting | Purpose |
|---------|---------|
| Scan image/video posts | Enable visual leak detection |
| Scan comments | Enable comment analysis |
| Scan suspicious DMs | Enable phishing detection |
| Instagram Handle | Link your account for reference |

All settings are saved locally in your browser storage.

## How to Verify It's Working

1. Open Instagram in a new tab
2. Scroll your feed or visit a post
3. Wait 4-5 seconds for the scanner to run
4. **If leaks are detected**, a banner will appear above/below the post showing:
   - Type of leak detected
   - Description of the risk
   - Advice for preventing similar leaks
5. A browser notification will also appear

## Example Scenario

**Post**: Photo of matcha with caption "daily coffee time" and comment "can't believe you moved to NYC, miss you already!"

**Detected leaks**:
- ✅ Routine leak (daily coffee time)
- ✅ Location leak (NYC mention in comment)
- ✅ Social context leak (moving/adjusting to new city)

**Banner shows**: 
```
Optic Privacy Guard
Potential leaks detected: Routine leak, Location leak, Social context leak

Your post suggests a daily beverage routine. This can reveal a 
repeated location or habit. A comment reveals your recent move or 
change of city, which is useful information...

Advice: Avoid sharing exact city or venue names in future posts.
Remove comments from your feed containing explicit moving details.
```

## Troubleshooting

### Extension not scanning anything
- ✅ Check that **page access** is enabled
- ✅ Wait 4-5 seconds after scrolling (initial scan delay)
- ✅ Check browser console (F12 → Console tab) for errors
- ✅ Ensure you're on a page with posts (instagram.com, twitter.com, etc.)

### Can't see all captions/comments
- This is likely due to Instagram's DOM protection
- Try refreshing the page
- Captions may be rendered with custom spans that our selectors miss

### Not detecting my account
- Instagram handles are case-insensitive but the URL must be correct
- Make sure there are no extra spaces or symbols

## Privacy & Security

- ⚠️ **No data is sent to external servers** (unless you add an AI backend)
- ✅ All scanning happens locally in your browser
- ✅ Extension does not track you or collect personal data
- ✅ Instagram handle is stored locally only

## Next Steps

### To Add AI-Powered Analysis
Currently, the extension uses regex-based heuristics. To add real AI detection:

1. Set up a backend server (Node.js, Python, etc.)
2. Integrate with OpenAI API, Claude API, or a local model
3. Update `content.js` to send image/text to your backend for analysis
4. Return detailed vulnerability reports

### To Add More Platforms
Add platform-specific selectors to `getPostContainers()` for:
- TikTok
- Facebook
- Snapchat
- LinkedIn

## Support & Feedback

This is an open-source privacy project. Found a bug? Want to contribute?

- File an issue on GitHub
- Submit improvements
- Help improve Instagram/platform compatibility

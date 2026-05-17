// Replay ry — community deck (for artists, scene, prospective members)

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaBroadcastTower, FaWaveSquare, FaHeadphones, FaMicrophone,
  FaCompactDisc, FaCrown, FaUsers, FaServer, FaPlay,
  FaCommentDots, FaSatelliteDish, FaCheckCircle, FaArrowRight,
  FaPodcast, FaMixcloud, FaSpotify, FaHandHoldingHeart, FaBalanceScale,
  FaCodeBranch, FaSeedling, FaHandsHelping, FaUserShield, FaGavel,
  FaInfinity, FaGlobe, FaLock, FaUnlock, FaHeart, FaMusic,
  FaFire, FaStar, FaTrophy, FaCog, FaCloudUploadAlt, FaLink,
  FaShieldAlt, FaBuilding,
} = require("react-icons/fa");

const COL = {
  bg: "0A0E27",
  bg2: "131836",
  card: "1B2151",
  cardBorder: "2B3270",
  cyan: "00D4FF",
  violet: "B388FF",
  mint: "3DDC97",
  amber: "FFB454",
  rose: "FF6B6B",
  textLight: "F0F2FF",
  textMuted: "8B92C0",
  textDim: "5A6090",
};

const F = { header: "Calibri", body: "Calibri Light" };

function renderIconSvg(IconComponent, color, size) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconPng(IconComponent, hex = COL.cyan, size = 256) {
  const svg = renderIconSvg(IconComponent, "#" + hex, size);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

const sh = (opacity = 0.4) => ({
  type: "outer", color: "000000", blur: 12, offset: 4, angle: 90, opacity,
});

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Replay ry";
  pres.title = "Replay \u2014 your radio station";

  // ─── Slide 1: title (artist-facing) ─────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    const mark = await iconPng(FaBroadcastTower, COL.amber, 512);
    s.addImage({ data: mark, x: 10.2, y: 0.5, w: 2.3, h: 1.4 });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 0.55, w: 0.06, h: 0.5, fill: { color: COL.amber }, line: { color: COL.amber },
    });
    s.addText("REPLAY", {
      x: 0.85, y: 0.5, w: 4, h: 0.55,
      fontFace: F.header, fontSize: 18, bold: true, color: COL.textLight, charSpacing: 4, margin: 0,
    });

    s.addText("Your radio station.", {
      x: 0.7, y: 2.1, w: 12, h: 1.1,
      fontFace: F.header, fontSize: 64, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Always on. Always yours.", {
      x: 0.7, y: 3.25, w: 12, h: 1.0,
      fontFace: F.header, fontSize: 48, italic: true, color: COL.amber, margin: 0,
    });

    s.addText(
      "One URL that always plays. Live when you\u2019re broadcasting, your archive when you\u2019re not. Listeners chat, download your tracks, and can support you directly with subscriptions \u2014 we take 0%, just a 2% fee for processing. Originals reach Spotify, mixes reach Mixcloud. Annual grants on top, paid from org surplus.",
      {
        x: 0.7, y: 4.55, w: 11, h: 1.9,
        fontFace: F.body, fontSize: 17, color: COL.textMuted, margin: 0,
      }
    );

    s.addText("FOR ARTISTS  \u00B7  HELSINKI  \u00B7  BETA INVITATIONS OPEN", {
      x: 0.7, y: 6.7, w: 10, h: 0.4,
      fontFace: F.header, fontSize: 10, color: COL.amber, charSpacing: 6, margin: 0,
    });
  }

  // ─── Slide 2: the problem ───────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("You\u2019re scattered across", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("six platforms that don\u2019t talk to each other.", {
      x: 0.7, y: 1.15, w: 12, h: 0.7, fontFace: F.header, fontSize: 32, italic: true, color: COL.rose, margin: 0,
    });

    // Six fragmented platform tiles
    const platforms = [
      { name: "SoundCloud",  pain: "Takedowns. Algorithm.",       color: COL.rose },
      { name: "Mixcloud",    pain: "Only mixes. No live.",        color: COL.amber },
      { name: "Spotify",     pain: "DJ mixes rejected.",          color: COL.mint },
      { name: "Bandcamp",    pain: "Recently sold. Uncertain.",   color: COL.cyan },
      { name: "Twitch",      pain: "Audio-only is a graveyard.",  color: COL.violet },
      { name: "Instagram",   pain: "Owns your reach.",            color: COL.rose },
    ];

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.7 + col * 4.05;
      const y = 2.25 + row * 1.6;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 3.85, h: 1.4,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 1.4, fill: { color: p.color, transparency: 30 }, line: { color: p.color, transparency: 30 },
      });
      s.addText(p.name, {
        x: x + 0.25, y: y + 0.2, w: 3.4, h: 0.5,
        fontFace: F.header, fontSize: 20, bold: true, color: COL.textLight, margin: 0,
      });
      s.addText(p.pain, {
        x: x + 0.25, y: y + 0.75, w: 3.4, h: 0.55,
        fontFace: F.body, fontSize: 13, italic: true, color: p.color, margin: 0,
      });
    }

    // Bottom strip — the realization
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 5.65, w: 11.9, h: 1.3,
      fill: { color: COL.bg2 }, line: { color: COL.amber, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 5.65, w: 0.08, h: 1.3, fill: { color: COL.amber }, line: { color: COL.amber },
    });
    s.addText([
      { text: "And none of them are yours.", options: { color: COL.amber, bold: true, fontSize: 22, breakLine: true } },
      { text: "You\u2019re renting attention from companies that change the rules whenever it suits them. Algorithm shifts. Pricing tiers. Acquisitions. Shutdowns.", options: { color: COL.textMuted, italic: true, fontSize: 14 } },
    ], { x: 1.0, y: 5.8, w: 11.4, h: 1.1, fontFace: F.body, margin: 0, valign: "top" });
  }

  // ─── Slide 3: the answer — your channel ─────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("One URL.", {
      x: 0.7, y: 0.5, w: 12, h: 0.9,
      fontFace: F.header, fontSize: 52, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Always playing.", {
      x: 0.7, y: 1.4, w: 12, h: 0.8,
      fontFace: F.header, fontSize: 40, italic: true, color: COL.cyan, margin: 0,
    });

    // The URL mockup
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 2.5, w: 11.9, h: 1.0,
      fill: { color: COL.bg2 }, line: { color: COL.cyan, width: 1.5 }, shadow: sh(0.35),
    });
    s.addText([
      { text: "https://", options: { color: COL.textDim, fontSize: 22 } },
      { text: "your-name", options: { color: COL.amber, fontSize: 22, bold: true } },
      { text: ".replay.fm", options: { color: COL.cyan, fontSize: 22, bold: true } },
    ], {
      x: 0.7, y: 2.5, w: 11.9, h: 1.0, align: "center", valign: "middle",
      fontFace: F.header, margin: 0,
    });

    // Two states side by side
    const states = [
      {
        x: 0.7, color: COL.mint, icon: FaMicrophone,
        head: "WHEN YOU\u2019RE LIVE",
        body: "Your broadcast streams to listeners in real time. Chat is active. Multistream to YouTube/Twitch fans out automatically. Recording starts on its own.",
      },
      {
        x: 6.85, color: COL.violet, icon: FaCompactDisc,
        head: "WHEN YOU\u2019RE OFFLINE",
        body: "Your archive keeps playing on rotation. Listeners can still tune in, chat, leave messages. Auto-recorded sets join the rotation automatically.",
      },
    ];
    for (const st of states) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: st.x, y: 3.85, w: 5.75, h: 2.6,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: st.x, y: 3.85, w: 5.75, h: 0.08, fill: { color: st.color }, line: { color: st.color },
      });
      const ic = await iconPng(st.icon, st.color, 256);
      s.addImage({ data: ic, x: st.x + 0.3, y: 4.05, w: 0.55, h: 0.55 });
      s.addText(st.head, {
        x: st.x + 1.0, y: 4.05, w: 4.6, h: 0.55,
        fontFace: F.header, fontSize: 14, bold: true, color: st.color, charSpacing: 4, valign: "middle", margin: 0,
      });
      s.addText(st.body, {
        x: st.x + 0.3, y: 4.8, w: 5.2, h: 1.55,
        fontFace: F.body, fontSize: 13, color: COL.textMuted, margin: 0, valign: "top",
      });
    }

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 6.65, w: 11.9, h: 0.55,
      fill: { color: COL.bg2 }, line: { color: COL.amber, width: 1 },
    });
    s.addText([
      { text: "NEVER A SILENT GAP.  ", options: { color: COL.amber, bold: true, charSpacing: 3 } },
      { text: "When you stop, the archive starts within 10 seconds. Listeners stay tuned in.", options: { color: COL.textMuted, italic: true } },
    ], { x: 0.95, y: 6.65, w: 11.5, h: 0.55, fontFace: F.body, fontSize: 13, valign: "middle", margin: 0 });
  }

  // ─── Slide 4: broadcasting is easy ──────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Broadcast from anything", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Your existing tools work. Copy-paste credentials, follow our guide, you\u2019re live in 5 minutes.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 15, italic: true, color: COL.textMuted, margin: 0,
    });

    const tools = [
      { name: "OBS Studio",  color: COL.cyan,   note: "RTMP \u00B7 video+audio", icon: FaBroadcastTower },
      { name: "Mixxx",       color: COL.violet, note: "Icecast \u00B7 open-source DJ",  icon: FaCompactDisc },
      { name: "Traktor Pro", color: COL.mint,   note: "Icecast \u00B7 NI workflow",    icon: FaWaveSquare },
      { name: "butt",        color: COL.amber,  note: "Icecast \u00B7 minimal streamer", icon: FaMicrophone },
      { name: "Browser",     color: COL.rose,   note: "WebRTC \u00B7 zero install",     icon: FaPlay },
      { name: "FFmpeg",      color: COL.textMuted, note: "CLI \u00B7 for power users", icon: FaCog },
    ];

    for (let i = 0; i < tools.length; i++) {
      const t = tools[i];
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.7 + col * 4.05;
      const y = 2.0 + row * 1.6;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 3.85, h: 1.4,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 1.4, fill: { color: t.color }, line: { color: t.color },
      });
      const ic = await iconPng(t.icon, t.color, 256);
      s.addImage({ data: ic, x: x + 0.25, y: y + 0.35, w: 0.7, h: 0.7 });
      s.addText(t.name, {
        x: x + 1.1, y: y + 0.25, w: 2.6, h: 0.5,
        fontFace: F.header, fontSize: 18, bold: true, color: COL.textLight, margin: 0,
      });
      s.addText(t.note, {
        x: x + 1.1, y: y + 0.75, w: 2.6, h: 0.5,
        fontFace: F.body, fontSize: 11, italic: true, color: t.color, margin: 0,
      });
    }

    // OBS guide preview card
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 5.3, w: 11.9, h: 1.85,
      fill: { color: COL.bg2 }, line: { color: COL.cyan, width: 1 }, shadow: sh(0.3),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 5.3, w: 0.08, h: 1.85, fill: { color: COL.cyan }, line: { color: COL.cyan },
    });
    s.addText("Personalized setup guide for every tool", {
      x: 1.0, y: 5.4, w: 11, h: 0.45,
      fontFace: F.header, fontSize: 16, bold: true, color: COL.cyan, charSpacing: 2, margin: 0,
    });
    s.addText([
      { text: "Open your dashboard. Click \"How to broadcast.\" Pick your tool. ", options: { color: COL.textMuted } },
      { text: "Your credentials are pre-filled and ready to copy-paste. ", options: { color: COL.textLight, bold: true } },
      { text: "Click ", options: { color: COL.textMuted } },
      { text: "\"Test connection\" ", options: { color: COL.cyan, italic: true, bold: true } },
      { text: "to verify your setup with a 10-second probe before you go live for real. Stream keys are rotatable from the dashboard whenever you need.", options: { color: COL.textMuted } },
    ], { x: 1.0, y: 5.9, w: 11.4, h: 1.2, fontFace: F.body, fontSize: 13, margin: 0, valign: "top" });
  }

  // ─── Slide 5: live chat is the centerpiece ──────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Your listeners are right there.", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("A real-time chat next to the player. Pinned announcements. Live reactions. No signup wall.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 15, italic: true, color: COL.textMuted, margin: 0,
    });

    // Mock chat preview
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 2.0, w: 6.5, h: 4.95,
      fill: { color: COL.bg2 }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.4),
    });
    // Pinned announcement at top
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.9, y: 2.2, w: 6.1, h: 0.7,
      fill: { color: COL.amber, transparency: 80 }, line: { color: COL.amber, width: 1 },
    });
    s.addText([
      { text: "\uD83D\uDCCC  ", options: { color: COL.amber, bold: true } },
      { text: "PINNED  \u00B7  YOUR ARTIST", options: { color: COL.amber, bold: true, fontSize: 9, charSpacing: 3, breakLine: true } },
      { text: "Tonight 22:00 UTC \u2014 ambient set, three new originals", options: { color: COL.textLight, fontSize: 12, italic: true } },
    ], { x: 1.0, y: 2.25, w: 5.9, h: 0.6, fontFace: F.body, margin: 0, valign: "middle" });

    // Chat messages mock
    const msgs = [
      { who: "moonglow_42", color: COL.cyan,   txt: "this track is killing me \uD83D\uDD25" },
      { who: "midnight_dj",  color: COL.violet, txt: "what synth is this?" },
      { who: "tallinn_owl",  color: COL.mint,   txt: "tuned in from Tallinn \uD83C\uDDEA\uD83C\uDDEA" },
      { who: "ghost",        color: COL.rose,   txt: "first time here \u2014 this is amazing" },
      { who: "you (artist)", color: COL.amber,  txt: "@midnight_dj \u2014 Prophet 5, sent through tape delay" },
      { who: "harmonic.air", color: COL.cyan,   txt: "the transition at 14:00 \uD83D\uDC4C" },
    ];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const y = 3.05 + i * 0.55;
      s.addText([
        { text: m.who, options: { color: m.color, fontSize: 11, bold: true } },
        { text: "  " + m.txt, options: { color: COL.textLight, fontSize: 12 } },
      ], { x: 0.9, y, w: 6.1, h: 0.45, fontFace: F.body, margin: 0, valign: "middle" });
    }

    // Chat info text on the right
    const info = [
      { icon: FaCommentDots, color: COL.violet, head: "Ephemeral by default",
        body: "Messages live for 24 hours. The vibe of a live show \u2014 not a permanent forum." },
      { icon: FaLock,        color: COL.amber,  head: "Anonymous listening",
        body: "No signup to listen. Listeners type a handle on first chat. You set the rules in your channel." },
      { icon: FaStar,        color: COL.mint,   head: "Pinned announcements",
        body: "Up to three pinned notes persist above chat. Show times, links, calls to action." },
      { icon: FaFire,        color: COL.rose,   head: "Live reactions",
        body: "Emoji bursts fly across the player. The roar of a live crowd, in audio-only." },
    ];
    for (let i = 0; i < info.length; i++) {
      const it = info[i];
      const y = 2.0 + i * 1.25;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 7.5, y, w: 5.1, h: 1.1,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.25),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: 7.5, y, w: 0.06, h: 1.1, fill: { color: it.color }, line: { color: it.color },
      });
      const ic = await iconPng(it.icon, it.color, 256);
      s.addImage({ data: ic, x: 7.7, y: y + 0.15, w: 0.4, h: 0.4 });
      s.addText(it.head, {
        x: 8.25, y: y + 0.1, w: 4.3, h: 0.4,
        fontFace: F.header, fontSize: 14, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(it.body, {
        x: 7.7, y: y + 0.55, w: 4.85, h: 0.55,
        fontFace: F.body, fontSize: 11, color: COL.textMuted, margin: 0, valign: "top",
      });
    }
  }

  // ─── Slide 6: your home page (profile + releases) ──────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Your home page on the internet.", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Bio, releases, channel \u2014 one URL that shows up when someone googles you.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 15, italic: true, color: COL.textMuted, margin: 0,
    });

    // Profile URL mockup
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 1.95, w: 11.9, h: 0.85,
      fill: { color: COL.bg2 }, line: { color: COL.amber, width: 1.5 }, shadow: sh(0.35),
    });
    s.addText([
      { text: "https://replay.fm/u/", options: { color: COL.textDim, fontSize: 20 } },
      { text: "your-handle", options: { color: COL.amber, fontSize: 20, bold: true } },
    ], {
      x: 0.7, y: 1.95, w: 11.9, h: 0.85, align: "center", valign: "middle",
      fontFace: F.header, margin: 0,
    });

    // 4-column layout: bio, releases, channel embed, externals
    const cols = [
      { x: 0.7,  icon: FaHeart,  color: COL.cyan,
        head: "Bio + photos",
        body: "Markdown-rich text with paragraphs, headings, images, and embedded video. Pull-quotes, links, the works. Looks like a label site, not a SoundCloud profile." },
      { x: 3.75, icon: FaMusic,  color: COL.violet,
        head: "Release timeline",
        body: "Albums, EPs, singles in chronological order. Upload in WAV or FLAC \u2014 we preserve the original. Studio tier downloads in FLAC, streams in transparent Opus 256." },
      { x: 6.80, icon: FaPlay,   color: COL.mint,
        head: "Channel embed",
        body: "Your 24/7 channel player embedded inline. Live state, current track, tune-in CTA. Listeners reach your broadcast from the same page as your discography." },
      { x: 9.85, icon: FaLink,   color: COL.amber,
        head: "Externals + press kit",
        body: "Instagram, Bandcamp, personal site \u2014 all in one place. Studio tier adds a downloadable press kit: bio in 200/400/1000-word variants, hi-res photos." },
    ];
    for (const c of cols) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: c.x, y: 2.95, w: 2.85, h: 3.6,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: c.x, y: 2.95, w: 2.85, h: 0.06, fill: { color: c.color }, line: { color: c.color },
      });
      const ic = await iconPng(c.icon, c.color, 256);
      s.addImage({ data: ic, x: c.x + 1.075, y: 3.2, w: 0.7, h: 0.7 });
      s.addText(c.head, {
        x: c.x + 0.15, y: 4.05, w: 2.55, h: 0.5, align: "center",
        fontFace: F.header, fontSize: 14, bold: true, color: COL.textLight, margin: 0,
      });
      s.addText(c.body, {
        x: c.x + 0.2, y: 4.6, w: 2.45, h: 1.9, align: "center",
        fontFace: F.body, fontSize: 11, color: COL.textMuted, margin: 0, valign: "top",
      });
    }

    // What's not on it strip
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 6.7, w: 11.9, h: 0.5,
      fill: { color: COL.bg2 }, line: { color: COL.textDim, width: 1 },
    });
    s.addText([
      { text: "WHAT'S NOT ON YOUR PROFILE:  ", options: { color: COL.textDim, bold: true, charSpacing: 3 } },
      { text: "no follower count, no track-level comments, no algorithmic feed. This is a label page, not a social profile.", options: { color: COL.textMuted, italic: true } },
    ], { x: 0.95, y: 6.7, w: 11.5, h: 0.5, fontFace: F.body, fontSize: 11, valign: "middle", margin: 0 });
  }

  // ─── Slide 7: tools to spread the word (promo toolkit) ─────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Tools to spread the word.", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Embed, smart links, newsletter, social auto-post, analytics \u2014 the things every artist asks for.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    const tools = [
      {
        icon: FaCodeBranch, color: COL.cyan,
        head: "Embed widget",
        body: "Drop your channel or any release into your website, Substack, Notion. Lightweight, theme-aware, no tracking. oEmbed-compatible \u2014 paste a URL and it just works.",
      },
      {
        icon: FaLink, color: COL.violet,
        head: "Smart links",
        body: "One URL routes to every platform: Spotify, Apple, Tidal, Bandcamp, SoundCloud. Customizable landing page. Per-platform click stats so you see where your audience actually is.",
      },
      {
        icon: FaCommentDots, color: COL.mint,
        head: "Newsletter",
        body: "A built-in mailing list per channel. Listeners subscribe with one click. Compose, schedule, send. GDPR-clean unsubscribe. No middleman, no \"Sent via Mailchimp\" footer.",
      },
      {
        icon: FaFire, color: COL.amber,
        head: "Social auto-post",
        body: "Connect Twitter, Mastodon, Threads, Bluesky. Triggers post for you when a release publishes or your channel goes live. Templates with placeholders \u2014 set it once, forget it.",
      },
      {
        icon: FaStar, color: COL.rose,
        head: "Track-level analytics",
        body: "Plays, completion rate, top countries, top embedding domains, smart-link clicks per platform. Honest aggregates, no personal data, exportable as CSV.",
      },
      {
        icon: FaShieldAlt, color: COL.textMuted,
        head: "Privacy by default",
        body: "No cookies for analytics. IP hashes rotate daily. \"Unique listener\" is a daily-bucketed concept. Slightly less precision than other platforms \u2014 that's the trade.",
      },
    ];

    for (let i = 0; i < tools.length; i++) {
      const t = tools[i];
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.7 + col * 4.05;
      const y = 2.0 + row * 2.55;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 3.85, h: 2.35,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 2.35, fill: { color: t.color }, line: { color: t.color },
      });
      const ic = await iconPng(t.icon, t.color, 256);
      s.addImage({ data: ic, x: x + 0.3, y: y + 0.25, w: 0.6, h: 0.6 });
      s.addText(t.head, {
        x: x + 1.1, y: y + 0.22, w: 2.65, h: 0.6,
        fontFace: F.header, fontSize: 15, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(t.body, {
        x: x + 0.3, y: y + 0.95, w: 3.45, h: 1.3,
        fontFace: F.body, fontSize: 10.5, color: COL.textMuted, margin: 0, valign: "top",
      });
    }
  }

  // ─── Slide 8: distribution ──────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Your music, everywhere it should be.", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 32, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Originals to Spotify, Apple, Tidal. Mixes to Mixcloud. From the same dashboard.", {
      x: 0.7, y: 1.1, w: 12, h: 0.5, fontFace: F.body, fontSize: 15, italic: true, color: COL.textMuted, margin: 0,
    });

    const lanes = [
      {
        x: 0.7, color: COL.mint, icon: FaSpotify, head: "Original tracks",
        target: "Spotify  \u00B7  Apple Music  \u00B7  Tidal  \u00B7  Amazon  \u00B7  Deezer",
        body: "Submit through our wizard. ISRC allocated for you. Live on every DSP in 7\u201310 days. Royalty reports pull back monthly to your dashboard.",
        cta: "Studio tier: 12 releases/yr included.\nArtist tier: \u20AC8/release pay-per-use.",
      },
      {
        x: 6.85, color: COL.violet, icon: FaMixcloud, head: "DJ mixes",
        target: "Mixcloud",
        body: "Spotify rejects DJ mixes for copyright. Mixcloud has the blanket licenses that make mixes legal \u2014 it\u2019s the right home. One-click push from your archive, tracklist auto-populated.",
        cta: "Free integration.\nAny tier.",
      },
    ];

    for (const ln of lanes) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: ln.x, y: 1.9, w: 5.75, h: 5.05,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: ln.x, y: 1.9, w: 5.75, h: 0.08, fill: { color: ln.color }, line: { color: ln.color },
      });
      const ic = await iconPng(ln.icon, ln.color, 256);
      s.addImage({ data: ic, x: ln.x + 0.25, y: 2.1, w: 0.6, h: 0.6 });
      s.addText(ln.head, {
        x: ln.x + 1.0, y: 2.1, w: 4.6, h: 0.6,
        fontFace: F.header, fontSize: 20, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(ln.target, {
        x: ln.x + 0.3, y: 2.85, w: 5.3, h: 0.5,
        fontFace: F.body, fontSize: 13, italic: true, color: ln.color, margin: 0,
      });
      s.addText(ln.body, {
        x: ln.x + 0.3, y: 3.45, w: 5.3, h: 1.85,
        fontFace: F.body, fontSize: 13, color: COL.textMuted, margin: 0, valign: "top",
      });
      // CTA strip
      s.addShape(pres.shapes.RECTANGLE, {
        x: ln.x + 0.3, y: 5.65, w: 5.3, h: 1.15,
        fill: { color: COL.bg2 }, line: { color: COL.cardBorder, width: 0.5 },
      });
      s.addText(ln.cta, {
        x: ln.x + 0.4, y: 5.7, w: 5.1, h: 1.05,
        fontFace: F.body, fontSize: 13, color: COL.textLight, valign: "middle", margin: 0,
      });
    }
  }

  // ─── Slide 7: your archive, your storage ────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Your archive is yours.", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("No enforced storage limits. No \u201Cyou\u2019ve used 80% of your quota\u201D anxiety.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 15, italic: true, color: COL.textMuted, margin: 0,
    });

    const points = [
      { icon: FaInfinity, color: COL.cyan,  head: "Keep everything",
        body: "Recorded a 200-hour back catalog of mixes? Keep them all. We don\u2019t delete to save costs." },
      { icon: FaUnlock,   color: COL.mint,  head: "Open formats",
        body: "Opus 256 for streaming, FLAC archival on Studio. No proprietary lock-in. Export anytime." },
      { icon: FaCloudUploadAlt, color: COL.amber, head: "Auto-archive live sets",
        body: "Every live broadcast saved automatically. Edit titles later or let them stay unnamed." },
      { icon: FaLink, color: COL.violet, head: "Fallback rotation",
        body: "Choose which archive items play when you\u2019re offline. Shuffle or ordered. Update anytime." },
    ];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.7 + col * 6.05;
      const y = 2.05 + row * 2.0;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 5.85, h: 1.8,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 1.8, fill: { color: p.color }, line: { color: p.color },
      });
      const ic = await iconPng(p.icon, p.color, 256);
      s.addImage({ data: ic, x: x + 0.3, y: y + 0.3, w: 0.65, h: 0.65 });
      s.addText(p.head, {
        x: x + 1.15, y: y + 0.25, w: 4.5, h: 0.55,
        fontFace: F.header, fontSize: 17, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(p.body, {
        x: x + 1.15, y: y + 0.9, w: 4.5, h: 0.85,
        fontFace: F.body, fontSize: 12, color: COL.textMuted, margin: 0, valign: "top",
      });
    }

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 6.2, w: 11.9, h: 0.7,
      fill: { color: COL.bg2 }, line: { color: COL.amber, width: 1 },
    });
    s.addText([
      { text: "OUR PROMISE:  ", options: { color: COL.amber, bold: true, charSpacing: 3 } },
      { text: "We track storage and display it openly on the public dashboard. We never cut you off. Written into the bylaws \u2014 see for yourself.", options: { color: COL.textMuted, italic: true } },
    ], { x: 0.95, y: 6.2, w: 11.5, h: 0.7, fontFace: F.body, fontSize: 13, valign: "middle", margin: 0 });
  }

  // ─── Slide 8: how money reaches you (engagement units + fan-subs) ─
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Two ways money reaches you.", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Direct from fans who support you. Plus a yearly grant from the org\u2019s surplus, weighted by engagement.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    // Two channels side-by-side
    const flows = [
      {
        x: 0.7, color: COL.amber, icon: FaHandHoldingHeart,
        head: "Direct fan-subscriptions",
        tag: "0% org take",
        body: [
          { text: "Fans subscribe directly to you for \u20AC1\u2013\u20AC100/month. ", options: { color: COL.textLight, bold: true } },
          { text: "Money flows fan \u2192 Stripe \u2192 you, with a 2% operational fee covering processing, GDPR, and support. ", options: { color: COL.textMuted } },
          { text: "Replay ry takes zero. ", options: { color: COL.amber, bold: true } },
          { text: "Subscribers get a badge, FLAC downloads, fan-only chat. You choose tiers and benefits.", options: { color: COL.textMuted } },
        ],
        fig: "\u20AC163k", figLabel: "to artists, 3yr total",
      },
      {
        x: 6.85, color: COL.mint, icon: FaSeedling,
        head: "Annual grant from surplus",
        tag: "Weighted by engagement units",
        body: [
          { text: "After audit each year, 90% of org surplus flows to artists as grants. ", options: { color: COL.textLight, bold: true } },
          { text: "Your share depends on ", options: { color: COL.textMuted } },
          { text: "engagement units", options: { color: COL.mint, bold: true } },
          { text: ": free downloads count 1\u00D7, paid-subscriber downloads count 5\u00D7, each \u20AC1 of fan-sub revenue counts 1\u00D7. ", options: { color: COL.textMuted } },
          { text: "Passive listening doesn\u2019t count. ", options: { color: COL.textLight, bold: true } },
          { text: "Engagement counts.", options: { color: COL.textMuted } },
        ],
        fig: "\u20AC206k", figLabel: "to artists, 3yr total",
      },
    ];

    for (const f of flows) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: f.x, y: 1.9, w: 5.75, h: 4.5,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: f.x, y: 1.9, w: 5.75, h: 0.08, fill: { color: f.color }, line: { color: f.color },
      });
      const ic = await iconPng(f.icon, f.color, 256);
      s.addImage({ data: ic, x: f.x + 0.3, y: 2.1, w: 0.55, h: 0.55 });
      s.addText(f.head, {
        x: f.x + 1.0, y: 2.08, w: 4.55, h: 0.5,
        fontFace: F.header, fontSize: 18, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(f.tag, {
        x: f.x + 1.0, y: 2.55, w: 4.55, h: 0.35,
        fontFace: F.body, fontSize: 11, italic: true, color: f.color, valign: "middle", margin: 0,
      });
      s.addText(f.body, {
        x: f.x + 0.3, y: 3.1, w: 5.15, h: 2.3,
        fontFace: F.body, fontSize: 12, margin: 0, valign: "top",
      });
      // big figure
      s.addShape(pres.shapes.RECTANGLE, {
        x: f.x + 0.3, y: 5.55, w: 5.15, h: 0.75,
        fill: { color: COL.bg2 }, line: { color: COL.cardBorder, width: 0.5 },
      });
      s.addText(f.fig, {
        x: f.x + 0.3, y: 5.55, w: 2.6, h: 0.75, align: "center",
        fontFace: F.header, fontSize: 26, bold: true, color: f.color, valign: "middle", margin: 0,
      });
      s.addText(f.figLabel, {
        x: f.x + 2.85, y: 5.55, w: 2.55, h: 0.75,
        fontFace: F.body, fontSize: 11, italic: true, color: COL.textMuted, valign: "middle", margin: 0,
      });
    }

    // Bottom strip — total math
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 6.55, w: 11.9, h: 0.65,
      fill: { color: COL.bg2 }, line: { color: COL.amber, width: 1 },
    });
    s.addText([
      { text: "TOTAL OVER 3 YEARS:  ", options: { color: COL.amber, bold: true, charSpacing: 3 } },
      { text: "~\u20AC369,000 in artists\u2019 hands \u2014 ", options: { color: COL.textLight, bold: true } },
      { text: "74% more than a model where the org takes a cut. Yours because of how we routed the money, not because we generated more of it.", options: { color: COL.textMuted, italic: true } },
    ], { x: 0.95, y: 6.55, w: 11.5, h: 0.65, fontFace: F.body, fontSize: 12, valign: "middle", margin: 0 });
  }

  // ─── Slide 9: you're a member, not a user ──────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("You\u2019re a member.", {
      x: 0.7, y: 0.5, w: 12, h: 0.9,
      fontFace: F.header, fontSize: 52, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Not a user. Not a customer.", {
      x: 0.7, y: 1.45, w: 12, h: 0.6,
      fontFace: F.header, fontSize: 26, italic: true, color: COL.violet, margin: 0,
    });

    s.addText(
      "Every paying artist is automatically a member of Replay ry, the Finnish nonprofit that runs the platform. You get a member number. You get a vote. You get a seat at the annual general meeting.",
      {
        x: 0.7, y: 2.25, w: 11.5, h: 1.0,
        fontFace: F.body, fontSize: 15, color: COL.textMuted, margin: 0,
      }
    );

    const rights = [
      { icon: FaGavel,           color: COL.cyan,    head: "One member, one vote",
        body: "Every member votes equally at the AGM. Founder\u2019s vote = newest member\u2019s vote." },
      { icon: FaBalanceScale,    color: COL.violet,  head: "Propose changes",
        body: "Members can propose motions. Pricing, grant formula, storage policy, board composition \u2014 anything is up for debate." },
      { icon: FaCodeBranch,      color: COL.mint,    head: "Read the source",
        body: "Every line of code is open source under AGPL-3.0. Inspect, audit, fork \u2014 the org can\u2019t hide anything in the code." },
      { icon: FaUserShield,      color: COL.amber,   head: "Elect the board",
        body: "Trustees serve 2-year terms, elected by members. From Year 2 onward, at least one trustee seat is reserved for elected artist representatives." },
    ];

    for (let i = 0; i < rights.length; i++) {
      const r = rights[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.7 + col * 6.05;
      const y = 3.6 + row * 1.7;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 5.85, h: 1.55,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 1.55, fill: { color: r.color }, line: { color: r.color },
      });
      const ic = await iconPng(r.icon, r.color, 256);
      s.addImage({ data: ic, x: x + 0.3, y: y + 0.25, w: 0.55, h: 0.55 });
      s.addText(r.head, {
        x: x + 1.05, y: y + 0.18, w: 4.65, h: 0.5,
        fontFace: F.header, fontSize: 15, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(r.body, {
        x: x + 1.05, y: y + 0.7, w: 4.65, h: 0.75,
        fontFace: F.body, fontSize: 12, color: COL.textMuted, margin: 0, valign: "top",
      });
    }
  }

  // ─── Slide: Replay Radio + venue calendar (NEW v6) ─────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("More ways to be found.", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Replay Radio amplifies your live broadcasts. Venue calendars surface where you\u2019re playing.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    // Two large cards side-by-side
    const features = [
      {
        x: 0.7, color: COL.cyan, icon: FaBroadcastTower,
        head: "Replay Radio", sub: "The org-operated 24/7 meta-stream",
        body: [
          { text: "When you go live, Replay Radio may relay your broadcast \u2014 along with whichever other channels are currently on air. ", options: { color: COL.textLight, bold: true } },
          { text: "Fair rotation, no curation, no editorial control. ", options: { color: COL.textMuted } },
          { text: "Multistreamed to Mixcloud Live ", options: { color: COL.cyan, bold: true } },
          { text: "so listeners can find you from outside the platform. Opt-out toggle in your settings if you prefer.", options: { color: COL.textMuted } },
        ],
        rows: [
          ["Source",       "Currently-live channels only"],
          ["Curation",     "None \u2014 algorithmic fair rotation"],
          ["Multistream",  "Mixcloud Live (legally clean)"],
          ["Opt-out",      "One toggle, takes effect immediately"],
        ],
      },
      {
        x: 6.85, color: COL.amber, icon: FaBuilding,
        head: "Venue calendars", sub: "Where you\u2019re playing, when, for whom",
        body: [
          { text: "Venues can register on Replay and publish calendars of broadcasts at their location. ", options: { color: COL.textLight, bold: true } },
          { text: "Your future gigs at a venue appear on the venue\u2019s page; their iCalendar feed shows up in your fans\u2019 calendar apps. ", options: { color: COL.textMuted } },
          { text: "Not a booking marketplace ", options: { color: COL.amber, bold: true } },
          { text: "\u2014 venues find artists, artists find venues, we just publish the schedule.", options: { color: COL.textMuted } },
        ],
        rows: [
          ["URL",        "replay.fm/v/<venue-slug>"],
          ["Calendar",   "iCalendar feed + JSON API"],
          ["Booking",    "Direct \u2014 we don\u2019t mediate"],
          ["Verification", "Manual, ~3 business days"],
        ],
      },
    ];

    for (const f of features) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: f.x, y: 1.95, w: 5.75, h: 5.0,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: f.x, y: 1.95, w: 5.75, h: 0.08, fill: { color: f.color }, line: { color: f.color },
      });
      const ic = await iconPng(f.icon, f.color, 256);
      s.addImage({ data: ic, x: f.x + 0.3, y: 2.15, w: 0.55, h: 0.55 });
      s.addText(f.head, {
        x: f.x + 1.0, y: 2.13, w: 4.55, h: 0.5,
        fontFace: F.header, fontSize: 18, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(f.sub, {
        x: f.x + 1.0, y: 2.6, w: 4.55, h: 0.35,
        fontFace: F.body, fontSize: 11, italic: true, color: f.color, valign: "middle", margin: 0,
      });
      s.addText(f.body, {
        x: f.x + 0.3, y: 3.15, w: 5.15, h: 1.85,
        fontFace: F.body, fontSize: 12, margin: 0, valign: "top",
      });
      // table-like rows
      for (let i = 0; i < f.rows.length; i++) {
        const [k, v] = f.rows[i];
        const y = 5.1 + i * 0.42;
        s.addText(k, {
          x: f.x + 0.3, y, w: 1.85, h: 0.36,
          fontFace: F.body, fontSize: 11, color: COL.textMuted, valign: "middle", margin: 0,
        });
        s.addText(v, {
          x: f.x + 2.2, y, w: 3.45, h: 0.36,
          fontFace: F.body, fontSize: 11.5, bold: true, color: COL.textLight, valign: "middle", margin: 0,
        });
      }
    }
  }

  // ─── Slide 10: pricing ──────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("What it costs", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Less than a Spotify Premium subscription. Fan-subs and grants on top \u2014 we take 0% of fan support.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    const tiers = [
      {
        icon: FaHeadphones, color: COL.textMuted, tag: "FREE", price: "\u20AC0",
        sub: "Try it out, no commitment", emphasize: false,
        features: ["1 channel", "5 archive items", "Live broadcasting", "Basic chat", "Downloads enabled", "60d inactive = auto-archive"],
      },
      {
        icon: FaMicrophone, color: COL.cyan, tag: "ARTIST", price: "\u20AC40",
        sub: "/year \u2014 most artists fit here", emphasize: false,
        features: [
          "Unlimited archive (no enforced limit)",
          "Every live set auto-archived",
          "1 multistream destination",
          "Mixcloud auto-upload",
          "Pay \u20AC8/release for Spotify etc.",
          "Fan-subs enabled \u2014 0% org cut",
          "Member of the association",
          "Eligible for annual grants",
        ],
      },
      {
        icon: FaTrophy, color: COL.violet, tag: "STUDIO", price: "\u20AC120",
        sub: "/year \u2014 working pros & labels", emphasize: true,
        features: [
          "Everything in Artist",
          "12 DSP releases/yr included",
          "Unlimited multistream destinations",
          "Custom domain",
          "Detailed listener insights",
          "FLAC live recording + downloads",
          "Press kit page",
          "API access",
        ],
      },
    ];

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const x = 1.7 + i * 3.5;
      const cardW = 3.3;
      const cardH = t.emphasize ? 5.0 : 4.8;
      const cardY = t.emphasize ? 1.9 : 2.0;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y: cardY, w: cardW, h: cardH,
        fill: { color: COL.card }, line: { color: t.emphasize ? t.color : COL.cardBorder, width: t.emphasize ? 2 : 1 },
        shadow: sh(t.emphasize ? 0.5 : 0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: cardY, w: cardW, h: 0.08, fill: { color: t.color }, line: { color: t.color },
      });
      if (t.emphasize) {
        s.addShape(pres.shapes.RECTANGLE, {
          x: x + cardW - 1.3, y: cardY + 0.15, w: 1.15, h: 0.35,
          fill: { color: t.color }, line: { color: t.color },
        });
        s.addText("RECOMMENDED", {
          x: x + cardW - 1.3, y: cardY + 0.15, w: 1.15, h: 0.35, align: "center",
          fontFace: F.header, fontSize: 9, bold: true, color: COL.bg, charSpacing: 2, valign: "middle", margin: 0,
        });
      }
      const ic = await iconPng(t.icon, t.color, 256);
      s.addImage({ data: ic, x: x + 0.25, y: cardY + 0.2, w: 0.5, h: 0.5 });
      s.addText(t.tag, {
        x: x + 0.85, y: cardY + 0.18, w: 2.0, h: 0.55,
        fontFace: F.header, fontSize: 14, bold: true, color: t.color, charSpacing: 4, margin: 0, valign: "middle",
      });
      s.addText(t.price, {
        x: x + 0.25, y: cardY + 0.85, w: 2.85, h: 0.85,
        fontFace: F.header, fontSize: 44, bold: true, color: COL.textLight, margin: 0,
      });
      s.addText(t.sub, {
        x: x + 0.25, y: cardY + 1.7, w: 2.85, h: 0.4,
        fontFace: F.body, fontSize: 10, italic: true, color: COL.textMuted, margin: 0,
      });
      const items = t.features.map((f, idx) => ({
        text: f,
        options: { bullet: { code: "25AA" }, color: COL.textMuted, fontSize: 11, breakLine: idx < t.features.length - 1 },
      }));
      s.addText(items, {
        x: x + 0.25, y: cardY + 2.15, w: 2.85, h: 2.8,
        fontFace: F.body, paraSpaceAfter: 3, margin: 0, valign: "top",
      });
    }
  }

  // ─── Slide 11: open source means free forever ──────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Open source means", {
      x: 0.7, y: 0.5, w: 12, h: 0.9,
      fontFace: F.header, fontSize: 48, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("we can\u2019t turn it against you.", {
      x: 0.7, y: 1.4, w: 12, h: 0.8,
      fontFace: F.header, fontSize: 40, italic: true, color: COL.mint, margin: 0,
    });

    s.addText(
      "Every line of code is published under AGPL-3.0. If the org is ever sold, captured, or fails, the code is still yours. Anyone can fork Replay and run their own instance \u2014 we encourage it.",
      {
        x: 0.7, y: 2.5, w: 11.5, h: 0.9,
        fontFace: F.body, fontSize: 14, color: COL.textMuted, margin: 0,
      }
    );

    const promises = [
      { icon: FaCodeBranch,  color: COL.cyan,   head: "Every page links to source",
        body: "The code running the platform is always one click away. AGPL section 13 requires it. We honor it." },
      { icon: FaUnlock,      color: COL.mint,   head: "Fork if we fail",
        body: "If Replay ry ever shuts down, the community can take over the code and the data. No platform graveyards." },
      { icon: FaBalanceScale, color: COL.violet, head: "Contributions welcome",
        body: "Send a pull request. We review. No contributor license agreement \u2014 your contributions stay AGPL." },
      { icon: FaShieldAlt,   color: COL.amber,  head: "Anti-extraction by design",
        body: "AGPL is copyleft. Anyone running modified Replay code as a network service must publish their changes. No silent extraction." },
    ];

    // Some IconExp aren't imported; fall back to FaShieldAlt placeholder check
    // (we have FaShieldAlt via destructure earlier in file? — re-verify)
    // FaShieldAlt is destructured at top.

    for (let i = 0; i < promises.length; i++) {
      const p = promises[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.7 + col * 6.05;
      const y = 3.55 + row * 1.7;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 5.85, h: 1.55,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 1.55, fill: { color: p.color }, line: { color: p.color },
      });
      const ic = await iconPng(p.icon, p.color, 256);
      s.addImage({ data: ic, x: x + 0.3, y: y + 0.25, w: 0.55, h: 0.55 });
      s.addText(p.head, {
        x: x + 1.05, y: y + 0.18, w: 4.65, h: 0.5,
        fontFace: F.header, fontSize: 15, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(p.body, {
        x: x + 1.05, y: y + 0.7, w: 4.65, h: 0.75,
        fontFace: F.body, fontSize: 12, color: COL.textMuted, margin: 0, valign: "top",
      });
    }
  }

  // ─── Slide 12: join us ──────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Be a founding artist.", {
      x: 0.7, y: 0.5, w: 12, h: 1.0,
      fontFace: F.header, fontSize: 54, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Help build the broadcasting tool you actually want.", {
      x: 0.7, y: 1.55, w: 12, h: 0.7,
      fontFace: F.header, fontSize: 26, italic: true, color: COL.amber, margin: 0,
    });

    const ways = [
      {
        num: "01", color: COL.cyan,
        title: "Apply for the private beta",
        body: "We\u2019re inviting 30\u201350 working artists from EU electronic scenes for the first round. You get a free channel for 12 months and direct input on what we ship.",
      },
      {
        num: "02", color: COL.violet,
        title: "Spread the word",
        body: "If you know other artists who deserve a better deal than what Spotify and SoundCloud offer, send them this deck. We\u2019d rather grow by word of mouth than by ads.",
      },
      {
        num: "03", color: COL.mint,
        title: "Contribute to the code",
        body: "The repo is open. The bylaws are open. If you\u2019re technical, propose a PR. If you\u2019re a lawyer or organizer, review the bylaws. If you\u2019re an artist, tell us what we\u2019re missing.",
      },
      {
        num: "04", color: COL.amber,
        title: "Join the AGM",
        body: "From the first AGM onward, every paying member has a voice. Pricing, grant formula, board composition \u2014 all up for discussion. Show up. Vote. Shape it.",
      },
    ];

    for (let i = 0; i < ways.length; i++) {
      const w = ways[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.7 + col * 6.05;
      const y = 2.5 + row * 2.05;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 5.85, h: 1.9,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 1.9, fill: { color: w.color }, line: { color: w.color },
      });
      s.addText(w.num, {
        x: x + 0.25, y: y + 0.15, w: 1.0, h: 0.55,
        fontFace: F.header, fontSize: 28, bold: true, color: w.color, margin: 0,
      });
      s.addText(w.title, {
        x: x + 1.3, y: y + 0.18, w: 4.4, h: 0.55,
        fontFace: F.header, fontSize: 15, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(w.body, {
        x: x + 0.3, y: y + 0.8, w: 5.4, h: 1.05,
        fontFace: F.body, fontSize: 12, color: COL.textMuted, margin: 0, valign: "top",
      });
    }

    s.addText("REPLAY  ry  \u00B7  HELSINKI  \u00B7  AGPL-3.0  \u00B7  hello@replay.fm", {
      x: 0.7, y: 6.95, w: 12.0, h: 0.4, align: "center",
      fontFace: F.header, fontSize: 10, color: COL.amber, charSpacing: 6, margin: 0,
    });
  }

  await pres.writeFile({ fileName: "/home/claude/replay-package-v6/slides/Replay-Community.pptx" });
  console.log("OK");
}

main().catch((e) => { console.error(e); process.exit(1); });

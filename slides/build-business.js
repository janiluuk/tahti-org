// Tahti ry — mission + sustainability deck

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaBroadcastTower, FaWaveSquare, FaHeadphones, FaMicrophone,
  FaCompactDisc, FaCrown, FaUsers, FaServer, FaExclamationTriangle,
  FaShieldAlt, FaBolt, FaDatabase, FaCog, FaTrophy, FaBuilding,
  FaPlay, FaCommentDots, FaSatelliteDish, FaCheckCircle, FaArrowRight,
  FaPodcast, FaMixcloud, FaSpotify, FaHandHoldingHeart, FaBalanceScale,
  FaCodeBranch, FaSeedling, FaHandsHelping, FaUserShield, FaGavel,
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
  pres.author = "Tahti ry";
  pres.title = "Tahti — Mission and Sustainability";

  // ─── Slide 1: title ─────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    const mark = await iconPng(FaBroadcastTower, COL.cyan, 512);
    s.addImage({ data: mark, x: 10.2, y: 0.5, w: 2.3, h: 1.4 });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 0.55, w: 0.06, h: 0.5, fill: { color: COL.cyan }, line: { color: COL.cyan },
    });
    s.addText("TAHTI  ry", {
      x: 0.85, y: 0.5, w: 4, h: 0.55,
      fontFace: F.header, fontSize: 18, bold: true, color: COL.textLight, charSpacing: 4, margin: 0,
    });

    s.addText("A nonprofit", {
      x: 0.7, y: 2.0, w: 12, h: 1.05,
      fontFace: F.header, fontSize: 60, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("broadcasting platform for artists,", {
      x: 0.7, y: 3.05, w: 12, h: 0.9,
      fontFace: F.header, fontSize: 36, italic: true, color: COL.cyan, margin: 0,
    });
    s.addText("owned by its members.", {
      x: 0.7, y: 3.85, w: 12, h: 0.9,
      fontFace: F.header, fontSize: 36, italic: true, color: COL.cyan, margin: 0,
    });

    s.addText(
      "Tahti ry is a Finnish registered association building open-source broadcasting infrastructure for independent musicians and DJs. Surplus is distributed annually as artist grants, visible on a public ledger.",
      {
        x: 0.7, y: 5.05, w: 11, h: 1.5,
        fontFace: F.body, fontSize: 15, color: COL.textMuted, margin: 0,
      }
    );

    s.addText("MAY 2026  \u00B7  HELSINKI  \u00B7  YHDISTYS  \u00B7  AGPL-3.0", {
      x: 0.7, y: 6.7, w: 10, h: 0.4,
      fontFace: F.header, fontSize: 10, color: COL.textDim, charSpacing: 6, margin: 0,
    });
  }

  // ─── Slide 2: the mission ────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("The mission", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });

    // Big quote-style mission
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 1.5, w: 11.9, h: 2.3,
      fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 1.5, w: 0.08, h: 2.3, fill: { color: COL.cyan }, line: { color: COL.cyan },
    });
    s.addText([
      { text: "Tahti ry advances the work of independent musicians and DJs by ", options: { color: COL.textLight } },
      { text: "providing them with a free, open-source broadcasting tool", options: { color: COL.cyan, bold: true } },
      { text: " that enables a 24/7 channel, distribution to music services, and ", options: { color: COL.textLight } },
      { text: "direct grants based on listener hours", options: { color: COL.mint, bold: true } },
      { text: ".", options: { color: COL.textLight } },
    ], {
      x: 1.1, y: 1.7, w: 11.3, h: 2.0,
      fontFace: F.body, fontSize: 22, italic: true, margin: 0, valign: "middle",
    });

    // Three pillars
    const pillars = [
      {
        icon: FaCodeBranch, color: COL.cyan,
        title: "Open source",
        body: "Every line under AGPL-3.0. Anyone can fork, run, contribute. No appropriation possible.",
      },
      {
        icon: FaBalanceScale, color: COL.violet,
        title: "Transparent",
        body: "Public ledger of all revenue, costs, and grants. Monthly rollups, annual reports, queryable API.",
      },
      {
        icon: FaHandHoldingHeart, color: COL.mint,
        title: "Member-owned",
        body: "Paying artists are members of the association. Members vote at the AGM. Surplus returns to them.",
      },
    ];

    for (let i = 0; i < pillars.length; i++) {
      const p = pillars[i];
      const x = 0.7 + i * 4.05;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 4.05, w: 3.85, h: 2.85,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 4.05, w: 3.85, h: 0.08, fill: { color: p.color }, line: { color: p.color },
      });
      const ic = await iconPng(p.icon, p.color, 256);
      s.addImage({ data: ic, x: x + 0.3, y: 4.25, w: 0.55, h: 0.55 });
      s.addText(p.title, {
        x: x + 1.0, y: 4.22, w: 2.7, h: 0.6,
        fontFace: F.header, fontSize: 18, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(p.body, {
        x: x + 0.3, y: 4.95, w: 3.4, h: 1.85,
        fontFace: F.body, fontSize: 12, color: COL.textMuted, margin: 0, valign: "top",
      });
    }
  }

  // ─── Slide 3: what the product is ───────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("The product", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("One URL per artist. Always playing. Live when they\u2019re on, archive when they\u2019re not.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 16, italic: true, color: COL.textMuted, margin: 0,
    });

    // 4-step flow
    const steps = [
      { icon: FaMicrophone, color: COL.cyan,   title: "Artist broadcasts",  body: "OBS, Mixxx, Traktor, butt, or browser-based Go Live" },
      { icon: FaBroadcastTower, color: COL.violet, title: "Channel goes live", body: "Liquidsoap distributes via HLS + optional RTMP multistream" },
      { icon: FaCommentDots, color: COL.mint, title: "Listeners + chat",    body: "Anonymous tune-in, ephemeral chat with pinned announcements" },
      { icon: FaCompactDisc, color: COL.amber, title: "Auto-archived",       body: "Recording saved, ready for distribution and fallback rotation" },
    ];

    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      const x = 0.7 + i * 3.05;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.95, w: 2.85, h: 2.7,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.95, w: 2.85, h: 0.08, fill: { color: st.color }, line: { color: st.color },
      });
      const ic = await iconPng(st.icon, st.color, 256);
      s.addImage({ data: ic, x: x + 1.05, y: 2.2, w: 0.75, h: 0.75 });
      s.addText(`STEP ${i + 1}`, {
        x, y: 3.1, w: 2.85, h: 0.3, align: "center",
        fontFace: F.header, fontSize: 9, bold: true, color: COL.textMuted, charSpacing: 4, margin: 0,
      });
      s.addText(st.title, {
        x: x + 0.15, y: 3.4, w: 2.55, h: 0.5, align: "center",
        fontFace: F.header, fontSize: 15, bold: true, color: COL.textLight, margin: 0,
      });
      s.addText(st.body, {
        x: x + 0.2, y: 3.85, w: 2.45, h: 0.75, align: "center",
        fontFace: F.body, fontSize: 11, color: COL.textMuted, margin: 0,
      });
    }

    // The magic strip — channel-first explanation
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 4.95, w: 11.9, h: 2.0,
      fill: { color: COL.bg2 }, line: { color: COL.cyan, width: 1 }, shadow: sh(0.3),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 4.95, w: 0.08, h: 2.0, fill: { color: COL.cyan }, line: { color: COL.cyan },
    });
    s.addText("The technical core", {
      x: 1.0, y: 5.1, w: 11, h: 0.5,
      fontFace: F.header, fontSize: 16, bold: true, color: COL.cyan, charSpacing: 3, margin: 0,
    });
    s.addText([
      { text: "Each channel runs as one perpetual Liquidsoap process. When the artist stops broadcasting, ", options: { color: COL.textMuted } },
      { text: "the channel does not go offline ", options: { color: COL.textLight, bold: true } },
      { text: "\u2014 the ", options: { color: COL.textMuted } },
      { text: "fallback() ", options: { color: COL.cyan, italic: true } },
      { text: "operator instantly switches to the archive playlist with ", options: { color: COL.textMuted } },
      { text: "no audio gap. ", options: { color: COL.textLight, bold: true } },
      { text: "The same URL that played a live set yesterday plays the recorded mixes today. This is the entire product compressed into one technical detail.", options: { color: COL.textMuted } },
    ], { x: 1.0, y: 5.6, w: 11.4, h: 1.3, fontFace: F.body, fontSize: 13, margin: 0, valign: "top" });
  }

  // ─── Slide 4: chat and OBS as featured ──────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Featured capabilities", {
      x: 0.7, y: 0.4, w: 12, h: 0.55, fontFace: F.header, fontSize: 30, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Seven pillars \u2014 chat, broadcast, editor, profile, promo, fan-subs, Tahti Radio.", {
      x: 0.7, y: 0.95, w: 12, h: 0.4, fontFace: F.body, fontSize: 12, italic: true, color: COL.textMuted, margin: 0,
    });

    // 3x2 grid of capability cards (3 cols, 2 rows)
    const features = [
      {
        x: 0.6,  y: 1.5, color: COL.violet, icon: FaCommentDots,
        head: "Live chat", sub: "Featured, not optional",
        rows: [
          ["Listeners",        "Anonymous, no signup"],
          ["Lifetime",         "24h ephemeral"],
          ["Announcements",    "Pinned, max 3"],
          ["Moderation",       "Per-channel, fingerprint"],
        ],
      },
      {
        x: 4.7,  y: 1.5, color: COL.cyan, icon: FaBroadcastTower,
        head: "Broadcast + editor", sub: "Live tools and in-browser DAW",
        rows: [
          ["Pro audio editor", "Multitrack, EQ, LUFS"],
          ["OBS, Mixxx, Traktor", "RTMP / Icecast"],
          ["Browser Go Live",  "WebRTC, no install"],
          ["Export",           "Archive, releases"],
        ],
      },
      {
        x: 8.8,  y: 1.5, color: COL.amber, icon: FaUserShield,
        head: "Profile + releases", sub: "The artist\u2019s home on the internet",
        rows: [
          ["Editor",           "Multitrack, EQ, LUFS"],
          ["URL",              "tahti.fm/u/<handle>"],
          ["Releases",         "Albums, EPs, singles"],
          ["Export",           "Archive, channel, DSP"],
        ],
      },
      {
        x: 0.6,  y: 4.3, color: COL.mint, icon: FaSatelliteDish,
        head: "Promo toolkit", sub: "Spread the word, measure it",
        rows: [
          ["Embed widget",     "oEmbed, ~25 KB"],
          ["Smart links",      "One URL \u2192 all DSPs"],
          ["Social auto-post", "Twitter, Mastodon, BS"],
          ["Track analytics",  "Plays, completion"],
        ],
      },
      {
        x: 4.7,  y: 4.3, color: COL.rose, icon: FaHandHoldingHeart,
        head: "Fan-subscriptions", sub: "Direct support \u2014 0% org take",
        rows: [
          ["Listener pays",    "Artist directly"],
          ["Org cut",          "0% (2% ops fee only)"],
          ["Subscriber perks", "Badge, FLAC downloads"],
          ["Stripe Connect",   "Express payouts"],
        ],
      },
      {
        x: 8.8,  y: 4.3, color: COL.textLight, icon: FaBroadcastTower,
        head: "Tahti Radio", sub: "24/7 live-relay meta-stream",
        rows: [
          ["Source",           "Currently-live channels"],
          ["Curation",         "None \u2014 fair rotation"],
          ["Multistream",      "Mixcloud Live only"],
          ["Opt-out",          "Per-channel toggle"],
        ],
      },
    ];

    for (const f of features) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: f.x, y: f.y, w: 4.0, h: 2.7,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.3),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: f.x, y: f.y, w: 4.0, h: 0.06, fill: { color: f.color }, line: { color: f.color },
      });
      const ic = await iconPng(f.icon, f.color, 256);
      s.addImage({ data: ic, x: f.x + 0.18, y: f.y + 0.18, w: 0.38, h: 0.38 });
      s.addText(f.head, {
        x: f.x + 0.65, y: f.y + 0.13, w: 3.25, h: 0.38,
        fontFace: F.header, fontSize: 13, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(f.sub, {
        x: f.x + 0.65, y: f.y + 0.48, w: 3.25, h: 0.26,
        fontFace: F.body, fontSize: 9, italic: true, color: f.color, valign: "middle", margin: 0,
      });
      for (let i = 0; i < f.rows.length; i++) {
        const [k, v] = f.rows[i];
        const y = f.y + 0.9 + i * 0.42;
        s.addText(k, {
          x: f.x + 0.18, y, w: 1.45, h: 0.36,
          fontFace: F.body, fontSize: 9.5, color: COL.textMuted, valign: "middle", margin: 0,
        });
        s.addText(v, {
          x: f.x + 1.65, y, w: 2.25, h: 0.36,
          fontFace: F.body, fontSize: 10, bold: true, color: COL.textLight, valign: "middle", margin: 0,
        });
      }
    }
  }

  // ─── Slide 5: pricing tiers ─────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Membership", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Listeners never pay. Paying artists become members of the association \u2014 eligible for annual grants.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    const tiers = [
      {
        icon: FaHeadphones, color: COL.textMuted, tag: "FREE", price: "\u20AC0",
        sub: "Free-tier artist", emphasize: false,
        features: ["1 channel", "5 archive items", "Pro audio editor (full)", "Live broadcasting", "Basic chat", "60-day inactive expiry"],
      },
      {
        icon: FaMicrophone, color: COL.cyan, tag: "PAYING", price: "\u20AC40",
        sub: "/year \u2014 paying artist", emphasize: true,
        features: [
          "Unlimited archive (no enforced limit)",
          "Auto-archive every live set",
          "Fan-subs + downloads",
          "1 multistream (Mixcloud Live)",
          "Newsletter + social auto-post",
          "Pay-per-release DSP \u20AC8",
          "Member of Tahti ry (grants eligible)",
        ],
      },
    ];

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const x = 2.4 + i * 4.6;
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

  // ─── Slide 6: storage policy ────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Generous storage, unenforced", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 32, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Hard limits are a tax on serious artists. We display usage, we nudge, we don\u2019t cut anyone off.", {
      x: 0.7, y: 1.1, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    // Three explainer cards
    const cards = [
      {
        x: 0.7, color: COL.cyan, head: "Soft target",
        sub: "500 MB / user (default)",
        body: "Displayed in the dashboard as a friendly gauge. Above target, the artist sees an appreciative note \u2014 not a warning. No enforcement at any level.",
      },
      {
        x: 4.85, color: COL.mint, head: "Aggregate transparency",
        sub: "Public on the dashboard",
        body: "Total platform storage, average per channel, top decile \u2014 all visible. The membership sees the strain and self-regulates collectively.",
      },
      {
        x: 9.0, color: COL.amber, head: "Anti-abuse safeguard",
        sub: "Hidden, never advertised",
        body: "A technical ceiling exists only to catch scripted abuse (gigabyte dumps overnight). Manual review, never automatic block. The user is contacted directly.",
      },
    ];

    for (const c of cards) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: c.x, y: 1.95, w: 3.6, h: 3.4,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: c.x, y: 1.95, w: 3.6, h: 0.08, fill: { color: c.color }, line: { color: c.color },
      });
      s.addText(c.head, {
        x: c.x + 0.25, y: 2.1, w: 3.2, h: 0.5,
        fontFace: F.header, fontSize: 16, bold: true, color: COL.textLight, margin: 0,
      });
      s.addText(c.sub, {
        x: c.x + 0.25, y: 2.6, w: 3.2, h: 0.4,
        fontFace: F.body, fontSize: 12, italic: true, color: c.color, margin: 0,
      });
      s.addText(c.body, {
        x: c.x + 0.25, y: 3.1, w: 3.2, h: 2.2,
        fontFace: F.body, fontSize: 12, color: COL.textMuted, margin: 0, valign: "top",
      });
    }

    // Bylaws commitment strip
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 5.55, w: 11.9, h: 1.4,
      fill: { color: COL.bg2 }, line: { color: COL.violet, width: 1 }, shadow: sh(0.3),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 5.55, w: 0.08, h: 1.4, fill: { color: COL.violet }, line: { color: COL.violet },
    });
    const gavel = await iconPng(FaGavel, COL.violet, 256);
    s.addImage({ data: gavel, x: 0.95, y: 5.7, w: 0.5, h: 0.5 });
    s.addText("Bylaws commitment (\u00A78 proposed)", {
      x: 1.6, y: 5.65, w: 11, h: 0.45,
      fontFace: F.header, fontSize: 13, bold: true, color: COL.violet, charSpacing: 2, valign: "middle", margin: 0,
    });
    s.addText([
      { text: "\u201CTahti ry does not impose enforced storage limits on member channels. The Board may revisit this policy if aggregate storage cost exceeds 25% of subscription revenue, by proposing an amendment subject to member vote at the next General Meeting.\u201D", options: { color: COL.textMuted, italic: true } },
    ], { x: 1.6, y: 6.1, w: 10.9, h: 0.8, fontFace: F.body, fontSize: 12, margin: 0, valign: "top" });
  }

  // ─── Slide 7: revenue mix ───────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Revenue model", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Subscriptions grow into the dominant stream; grants fund the founding years.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 16, italic: true, color: COL.textMuted, margin: 0,
    });

    const labels = ["Year 1\n200 paid", "Year 2\n1,200 paid", "Year 3\n4,000 paid"];
    const data = [
      { name: "Paying-artist subs (\u20AC40)", labels, values: [8000, 48000, 160000] },
      { name: "Distribution (gross)",          labels, values: [960, 5760, 19200] },
      { name: "Foundation grants",             labels, values: [25000, 45000, 80000] },
      { name: "Donations + referral",          labels, values: [986, 6204, 22072] },
    ];

    s.addChart(pres.charts.BAR, data, {
      x: 0.7, y: 2.0, w: 12.0, h: 4.5,
      barDir: "col", barGrouping: "stacked",
      chartColors: [COL.cyan, COL.violet, COL.rose, COL.mint, COL.amber],
      chartArea: { fill: { color: COL.bg } }, plotArea: { fill: { color: COL.bg } },
      catAxisLabelColor: COL.textMuted, catAxisLabelFontSize: 12,
      valAxisLabelColor: COL.textMuted, valAxisLabelFontSize: 11,
      valGridLine: { color: COL.cardBorder, size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: COL.textLight, legendFontSize: 10,
      showTitle: false,
    });

    const totals = [34946, 104964, 281272];
    for (let i = 0; i < 3; i++) {
      const x = 1.6 + i * 4.0;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 6.6, w: 3.0, h: 0.6,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 },
      });
      s.addText(`\u20AC${totals[i].toLocaleString()}`, {
        x, y: 6.6, w: 3.0, h: 0.6,
        fontFace: F.header, fontSize: 18, bold: true, color: COL.cyan, align: "center", valign: "middle", margin: 0,
      });
    }
  }

  // ─── Slide 8: where the money goes ──────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Where the money goes", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Year 3 illustrative breakdown. 90% of surplus returns to artists; 10% builds operating reserve.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    // Sankey-like flow: revenue → costs / surplus → grants / reserve
    // Implemented as a 2-stage bar chart
    s.addChart(pres.charts.BAR, [{
      name: "Y3 allocation",
      labels: ["Infrastructure + ops", "Director salary", "Audit + admin", "Distribution pass-through", "Stripe + payment fees", "Artist grants", "Operating reserve"],
      values: [69280, 45000, 6000, 43200, 4640, 102737, 11415],
    }], {
      x: 0.7, y: 2.0, w: 8.0, h: 4.8,
      barDir: "bar",
      chartColors: [COL.cyan],
      chartArea: { fill: { color: COL.bg } }, plotArea: { fill: { color: COL.bg } },
      catAxisLabelColor: COL.textMuted, catAxisLabelFontSize: 11,
      valAxisLabelColor: COL.textMuted, valAxisLabelFontSize: 10,
      valGridLine: { color: COL.cardBorder, size: 0.5 }, catGridLine: { style: "none" },
      showLegend: false,
      showValue: true, dataLabelColor: COL.textLight, dataLabelFontSize: 10, dataLabelPosition: "outEnd",
      showTitle: true, title: "Year 3 outflows (\u20AC)",
      titleColor: COL.textLight, titleFontSize: 14,
    });

    // Grant pool highlight box
    s.addShape(pres.shapes.RECTANGLE, {
      x: 9.0, y: 2.0, w: 3.7, h: 4.8,
      fill: { color: COL.card }, line: { color: COL.mint, width: 2 }, shadow: sh(0.4),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 9.0, y: 2.0, w: 3.7, h: 0.08, fill: { color: COL.mint }, line: { color: COL.mint },
    });
    const seedling = await iconPng(FaSeedling, COL.mint, 256);
    s.addImage({ data: seedling, x: 9.2, y: 2.25, w: 0.55, h: 0.55 });
    s.addText("Year 3 grant pool", {
      x: 9.0, y: 2.9, w: 3.7, h: 0.45, align: "center",
      fontFace: F.header, fontSize: 14, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("\u20AC102,737", {
      x: 9.0, y: 3.35, w: 3.7, h: 0.9, align: "center",
      fontFace: F.header, fontSize: 36, bold: true, color: COL.mint, margin: 0,
    });
    s.addText("to ~4,000 artist members", {
      x: 9.0, y: 4.2, w: 3.7, h: 0.4, align: "center",
      fontFace: F.body, fontSize: 11, italic: true, color: COL.textMuted, margin: 0,
    });
    s.addText([
      { text: "Weighted by engagement units:\n", options: { color: COL.textLight, bold: true, breakLine: true } },
      { text: "Top 10% ", options: { color: COL.textMuted } },
      { text: "\u2192 ~\u20AC210 each\n", options: { color: COL.mint, bold: true, breakLine: true } },
      { text: "Mid 30% ", options: { color: COL.textMuted } },
      { text: "\u2192 ~\u20AC17 each\n", options: { color: COL.cyan, bold: true, breakLine: true } },
      { text: "Active rest ", options: { color: COL.textMuted } },
      { text: "\u2192 ~\u20AC4 each", options: { color: COL.violet, bold: true } },
    ], { x: 9.2, y: 4.75, w: 3.3, h: 1.95, fontFace: F.body, fontSize: 12, margin: 0, valign: "top" });
  }

  // ─── Slide 9: 3-year summary ────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Three-year picture", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Year 1 needs a founding grant to bridge the deficit. Year 2 and 3 build surplus.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    s.addTable([
      [
        { text: "",                          options: { fill: { color: COL.bg2 } } },
        { text: "Year 1",                    options: { color: COL.textMuted, bold: true, fill: { color: COL.bg2 }, fontSize: 12, align: "right" } },
        { text: "Year 2",                    options: { color: COL.textMuted, bold: true, fill: { color: COL.bg2 }, fontSize: 12, align: "right" } },
        { text: "Year 3",                    options: { color: COL.textMuted, bold: true, fill: { color: COL.bg2 }, fontSize: 12, align: "right" } },
        { text: "3-year total",              options: { color: COL.textMuted, bold: true, fill: { color: COL.bg2 }, fontSize: 12, align: "right" } },
      ],
      [
        { text: "Paying artists",            options: { color: COL.textLight, fontSize: 12 } },
        { text: "200",                       options: { color: COL.textLight, fontSize: 12, align: "right" } },
        { text: "1,200",                     options: { color: COL.textLight, fontSize: 12, align: "right" } },
        { text: "4,000",                     options: { color: COL.textLight, fontSize: 12, align: "right" } },
        { text: "\u2014",                    options: { color: COL.textMuted, fontSize: 12, align: "right" } },
      ],
      [
        { text: "Total revenue",             options: { color: COL.textLight, fontSize: 12 } },
        { text: "\u20AC34,946",              options: { color: COL.cyan, fontSize: 12, align: "right" } },
        { text: "\u20AC104,964",             options: { color: COL.cyan, fontSize: 12, align: "right" } },
        { text: "\u20AC281,272",             options: { color: COL.cyan, fontSize: 12, align: "right" } },
        { text: "\u20AC421,182",             options: { color: COL.cyan, fontSize: 13, bold: true, align: "right" } },
      ],
      [
        { text: "Total costs (incl. salary)", options: { color: COL.textLight, fontSize: 12 } },
        { text: "\u20AC54,382",              options: { color: COL.rose, fontSize: 12, align: "right" } },
        { text: "\u20AC91,412",              options: { color: COL.rose, fontSize: 12, align: "right" } },
        { text: "\u20AC167,120",             options: { color: COL.rose, fontSize: 12, align: "right" } },
        { text: "\u20AC312,914",             options: { color: COL.rose, fontSize: 13, bold: true, align: "right" } },
      ],
      [
        { text: "Surplus",                   options: { color: COL.textLight, fontSize: 12, bold: true } },
        { text: "-\u20AC19,436",             options: { color: COL.rose, fontSize: 12, bold: true, align: "right" } },
        { text: "+\u20AC13,552",             options: { color: COL.mint, fontSize: 12, bold: true, align: "right" } },
        { text: "+\u20AC114,152",            options: { color: COL.mint, fontSize: 12, bold: true, align: "right" } },
        { text: "+\u20AC108,268",            options: { color: COL.mint, fontSize: 13, bold: true, align: "right" } },
      ],
      [
        { text: "Director salary",           options: { color: COL.textLight, fontSize: 12 } },
        { text: "\u20AC30,000",              options: { color: COL.amber, fontSize: 12, align: "right" } },
        { text: "\u20AC40,000",              options: { color: COL.amber, fontSize: 12, align: "right" } },
        { text: "\u20AC45,000",              options: { color: COL.amber, fontSize: 12, align: "right" } },
        { text: "\u20AC115,000",             options: { color: COL.amber, fontSize: 13, bold: true, align: "right" } },
      ],
      [
        { text: "Artist grants distributed", options: { color: COL.textLight, fontSize: 12, bold: true } },
        { text: "\u20AC0",                   options: { color: COL.mint, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC12,197",              options: { color: COL.mint, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC102,737",             options: { color: COL.mint, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC114,934",             options: { color: COL.mint, fontSize: 13, bold: true, align: "right" } },
      ],
      [
        { text: "Fan-sub direct to artists", options: { color: COL.textLight, fontSize: 12, bold: true } },
        { text: "\u20AC1,622",               options: { color: COL.violet, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC22,705",              options: { color: COL.violet, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC138,394",             options: { color: COL.violet, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC162,721",             options: { color: COL.violet, fontSize: 13, bold: true, align: "right" } },
      ],
      [
        { text: "Total artist money",        options: { color: COL.textLight, fontSize: 12, bold: true } },
        { text: "\u20AC1,622",               options: { color: COL.amber, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC34,902",              options: { color: COL.amber, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC241,131",             options: { color: COL.amber, fontSize: 12, bold: true, align: "right" } },
        { text: "\u20AC277,655",             options: { color: COL.amber, fontSize: 14, bold: true, align: "right" } },
      ],
    ], {
      x: 0.7, y: 2.0, w: 12.0, h: 4.4,
      colW: [3.6, 2.1, 2.1, 2.1, 2.1],
      border: { type: "solid", pt: 0.5, color: COL.cardBorder },
      fontFace: F.body, rowH: 0.48,
      fill: { color: COL.card },
    });

    // The honest read strip
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 6.45, w: 12.0, h: 0.7,
      fill: { color: COL.bg2 }, line: { color: COL.mint, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 6.45, w: 0.08, h: 0.7, fill: { color: COL.mint }, line: { color: COL.mint },
    });
    s.addText([
      { text: "THE HEADLINE:  ", options: { color: COL.mint, bold: true, charSpacing: 3 } },
      { text: "\u20AC278k in artists\u2019 hands over 3 years \u2014 grants + direct fan-subs \u2014 while paying the director a fair Finnish wage.", options: { color: COL.textLight, italic: true } },
    ], { x: 0.95, y: 6.45, w: 11.5, h: 0.7, fontFace: F.body, fontSize: 13, valign: "middle", margin: 0 });
  }

  // ─── Slide 10: governance & transparency ────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Governance and transparency", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 32, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("Finnish yhdistys, AGPL software, public ledger. The structure makes promises keepable.", {
      x: 0.7, y: 1.1, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    const blocks = [
      {
        x: 0.7, color: COL.cyan, icon: FaGavel, head: "Yhdistys structure",
        rows: [
          ["Members", "Paying artists, one vote each"],
          ["Board", "3-5 trustees, 2-yr terms"],
          ["Director", "Paid employee, salary cap 30% of revenue"],
          ["AGM", "Annual, electronic OK, motions voted"],
          ["Audit", "Required at \u20AC100k+ revenue (Y2 on)"],
        ],
      },
      {
        x: 4.85, color: COL.violet, icon: FaCodeBranch, head: "AGPL-3.0 software",
        rows: [
          ["License", "Copyleft, viral, network-aware"],
          ["Forks", "Welcome \u2014 must publish modifications"],
          ["Per AGPL \u00A713", "Every page links to source"],
          ["/source endpoint", "Live tarball of running version"],
          ["Contributions", "Welcome, no CLA required"],
        ],
      },
      {
        x: 9.0, color: COL.mint, icon: FaBalanceScale, head: "Public ledger",
        rows: [
          ["Monthly rollup", "Published within 30 days"],
          ["Annual report", "Audited, published in March"],
          ["Per-channel grants", "Public (anonymized by default)"],
          ["API", "Read-only, CORS-open, queryable"],
          ["Corrections", "Append-only, audit-traced"],
        ],
      },
    ];

    for (const b of blocks) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: b.x, y: 1.95, w: 3.6, h: 5.0,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: b.x, y: 1.95, w: 3.6, h: 0.08, fill: { color: b.color }, line: { color: b.color },
      });
      const ic = await iconPng(b.icon, b.color, 256);
      s.addImage({ data: ic, x: b.x + 0.25, y: 2.15, w: 0.5, h: 0.5 });
      s.addText(b.head, {
        x: b.x + 0.9, y: 2.13, w: 2.6, h: 0.55,
        fontFace: F.header, fontSize: 15, bold: true, color: b.color, charSpacing: 2, valign: "middle", margin: 0,
      });
      for (let i = 0; i < b.rows.length; i++) {
        const [k, v] = b.rows[i];
        const y = 2.9 + i * 0.8;
        s.addText(k, {
          x: b.x + 0.25, y, w: 3.1, h: 0.32,
          fontFace: F.body, fontSize: 11, italic: true, color: COL.textMuted, margin: 0,
        });
        s.addText(v, {
          x: b.x + 0.25, y: y + 0.3, w: 3.1, h: 0.4,
          fontFace: F.body, fontSize: 12, bold: true, color: COL.textLight, margin: 0,
        });
      }
    }
  }

  // ─── Slide 11: funding strategy ─────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Funding strategy", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("The Y1 grant gap is the existential question. Securing one of these is the first milestone.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    // Funding sources as horizontal bars
    const sources = [
      { name: "Business Finland Tempo",           max: 50000, year: "Y0\u2013Y1", color: COL.cyan },
      { name: "Koneen S\u00E4\u00E4ti\u00F6",     max: 40000, year: "Y0\u2013Y3", color: COL.violet },
      { name: "Creative Europe (Culture)",         max: 80000, year: "Y2\u2013Y3", color: COL.mint },
      { name: "Suomen Kulttuurirahasto",           max: 20000, year: "Y1\u2013Y3", color: COL.amber },
      { name: "Helsinki city culture grants",      max: 10000, year: "Y1\u2013Y3", color: COL.rose },
      { name: "Music Finland (Musex)",             max: 10000, year: "Y2\u2013Y3", color: COL.textMuted },
    ];

    const maxBar = 80000;
    const barAreaX = 4.5;
    const barAreaW = 7.5;

    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const y = 2.1 + i * 0.7;
      const w = (src.max / maxBar) * barAreaW;

      s.addText(src.name, {
        x: 0.7, y, w: 3.6, h: 0.55,
        fontFace: F.body, fontSize: 13, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: barAreaX, y: y + 0.08, w: barAreaW, h: 0.4,
        fill: { color: COL.bg2 }, line: { color: COL.cardBorder, width: 0.5 },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: barAreaX, y: y + 0.08, w, h: 0.4,
        fill: { color: src.color, transparency: 20 }, line: { color: src.color, width: 1 },
      });
      s.addText(`up to \u20AC${src.max.toLocaleString()}  \u00B7  ${src.year}`, {
        x: barAreaX + 0.1, y: y + 0.08, w: w - 0.2, h: 0.4,
        fontFace: F.body, fontSize: 11, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
    }

    // Bottom callout
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 6.45, w: 11.9, h: 0.7,
      fill: { color: COL.bg2 }, line: { color: COL.amber, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 6.45, w: 0.08, h: 0.7, fill: { color: COL.amber }, line: { color: COL.amber },
    });
    s.addText([
      { text: "Y1 GOAL:  ", options: { color: COL.amber, bold: true, charSpacing: 3 } },
      { text: "secure \u20AC25,000 from any single source (or split across two). Apply to Tempo + Koneen + Kulttuurirahasto in parallel.", options: { color: COL.textMuted, italic: true } },
    ], { x: 0.95, y: 6.45, w: 11.5, h: 0.7, fontFace: F.body, fontSize: 13, valign: "middle", margin: 0 });
  }

  // ─── Slide 12: the ask / next steps ────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: COL.bg };

    s.addText("Next twelve months", {
      x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: F.header, fontSize: 36, bold: true, color: COL.textLight, margin: 0,
    });
    s.addText("From founding meeting to first beta, with the grant deadlines that shape the calendar.", {
      x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: F.body, fontSize: 14, italic: true, color: COL.textMuted, margin: 0,
    });

    const steps = [
      {
        num: "Q-1", color: COL.cyan,
        title: "Pre-founding",
        body: "Engage Finnish association lawyer. Draft bylaws. Identify 3 founding members and 2-3 board candidates. Reserve \u20AC2k for legal setup.",
      },
      {
        num: "Q1", color: COL.violet,
        title: "Founding + grants",
        body: "Founding meeting. PRH registration. Submit Tempo, Koneen, Kulttuurirahasto applications in parallel. Begin building M0\u2013M2.",
      },
      {
        num: "Q2", color: COL.mint,
        title: "Private beta",
        body: "Build M3\u2013M5. Invite 30\u201350 hand-picked artists from Helsinki/EU scene. Iterate from real feedback. Tempo decision expected.",
      },
      {
        num: "Q3", color: COL.amber,
        title: "Public launch",
        body: "Build M6\u2013M7 (multistream + distribution). Open public signups. Press push: RA, Mixmag, Wire, Native Instruments Blog.",
      },
      {
        num: "Q4", color: COL.rose,
        title: "First AGM",
        body: "Annual general meeting before March. Y1 closes with audited financials. No grants Y1 (no surplus), but model proven.",
      },
    ];

    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      const x = 0.7 + (i % 3) * 4.05;
      const y = 2.0 + Math.floor(i / 3) * 2.5;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 3.85, h: 2.3,
        fill: { color: COL.card }, line: { color: COL.cardBorder, width: 1 }, shadow: sh(0.35),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 2.3, fill: { color: st.color }, line: { color: st.color },
      });
      s.addText(st.num, {
        x: x + 0.25, y: y + 0.15, w: 1.0, h: 0.55,
        fontFace: F.header, fontSize: 24, bold: true, color: st.color, margin: 0,
      });
      s.addText(st.title, {
        x: x + 1.25, y: y + 0.2, w: 2.5, h: 0.5,
        fontFace: F.header, fontSize: 14, bold: true, color: COL.textLight, valign: "middle", margin: 0,
      });
      s.addText(st.body, {
        x: x + 0.3, y: y + 0.85, w: 3.4, h: 1.35,
        fontFace: F.body, fontSize: 11, color: COL.textMuted, margin: 0, valign: "top",
      });
    }

    s.addText("TAHTI  ry  \u00B7  HELSINKI  \u00B7  AGPL-3.0  \u00B7  YHDISTYS  \u00B7  2026", {
      x: 0.7, y: 6.95, w: 12.0, h: 0.4, align: "center",
      fontFace: F.header, fontSize: 10, color: COL.textDim, charSpacing: 6, margin: 0,
    });
  }

  await pres.writeFile({ fileName: "slides/Tahti-Business.pptx" });
  console.log("OK");
}

main().catch((e) => { console.error(e); process.exit(1); });

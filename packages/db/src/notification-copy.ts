// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** In-app notification title/body by `User.uiLocale` (EN default). */

export type NotificationLocale = 'en' | 'fi'

export function resolveNotificationLocale(uiLocale: string | null | undefined): NotificationLocale {
  return uiLocale?.toLowerCase().startsWith('fi') ? 'fi' : 'en'
}

export type NotificationCopy = { title: string; body: string | null }

export function themeUnderReviewCopy(
  locale: NotificationLocale,
  themeName: string,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `"${themeName}" on arvioitavana`,
      body: 'Ylläpito hyväksyy tai hylkää sen pian.',
    }
  }
  return {
    title: `"${themeName}" is in review`,
    body: 'An admin will approve or reject it soon.',
  }
}

export function themeApprovedCopy(locale: NotificationLocale, themeName: string): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `"${themeName}" hyväksyttiin`,
      body: 'Avataan pull request julkaisua varten.',
    }
  }
  return {
    title: `"${themeName}" was approved`,
    body: 'Opening a pull request to publish it now.',
  }
}

export function themeRejectedCopy(
  locale: NotificationLocale,
  themeName: string,
  moderationNote: string,
): NotificationCopy {
  return {
    title: locale === 'fi' ? `"${themeName}" hylättiin` : `"${themeName}" was rejected`,
    body: moderationNote.slice(0, 500),
  }
}

export function newPostCopy(
  locale: NotificationLocale,
  artistName: string,
  post: { title: string | null; body: string },
): NotificationCopy {
  return {
    title:
      locale === 'fi' ? `${artistName} julkaisi päivityksen` : `${artistName} posted an update`,
    body: (post.title?.trim() || post.body.slice(0, 140)).slice(0, 140),
  }
}

export function newTrackCopy(
  locale: NotificationLocale,
  artistName: string,
  trackTitle: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi' ? `${artistName} jakoi uuden kappaleen` : `${artistName} shared a new track`,
    body: trackTitle,
  }
}

export function venueShowBookedCopy(
  locale: NotificationLocale,
  artistName: string,
  venueName: string,
  startAt: Date,
): NotificationCopy {
  const date = startAt.toISOString().slice(0, 10)
  if (locale === 'fi') {
    return {
      title: `${artistName} lisäsi keikan paikkaan ${venueName}`,
      body: `${date}`,
    }
  }
  return {
    title: `${artistName} added a show at ${venueName}`,
    body: `On ${date}`,
  }
}

export function channelLiveCopy(locale: NotificationLocale, artistName: string): NotificationCopy {
  return {
    title: locale === 'fi' ? `${artistName} on livessä` : `${artistName} is live`,
    body: null,
  }
}

export function venueShowCanceledCopy(
  locale: NotificationLocale,
  byVenue: boolean,
  venueName: string,
  actorName: string,
  startAt: Date,
): NotificationCopy {
  const date = startAt.toISOString().slice(0, 10)
  if (locale === 'fi') {
    return {
      title: byVenue
        ? `${venueName} perui keikkasi`
        : `${actorName} perui keikkansa paikassa ${venueName}`,
      body: `Se oli ${date}`,
    }
  }
  return {
    title: byVenue
      ? `${venueName} cancelled your show`
      : `${actorName} cancelled their show at ${venueName}`,
    body: `It was on ${date}`,
  }
}

export function newEventCopy(
  locale: NotificationLocale,
  artistName: string,
  event: { title: string; place: string; location: string },
): NotificationCopy {
  return {
    title:
      locale === 'fi' ? `${artistName} ilmoitti tapahtumasta` : `${artistName} announced an event`,
    body: `${event.title} · ${event.place}, ${event.location}`,
  }
}

export function newReleaseCopy(
  locale: NotificationLocale,
  artistName: string,
  releaseTitle: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `${artistName} julkaisi ”${releaseTitle}”`
        : `${artistName} released "${releaseTitle}"`,
    body: null,
  }
}

export function newFollowerCopy(
  locale: NotificationLocale,
  followerName: string,
  followerUsername: string,
): NotificationCopy {
  return {
    title: locale === 'fi' ? `${followerName} alkoi seurata sinua` : `${followerName} followed you`,
    body: `@${followerUsername}`,
  }
}

export function newLikeCopy(
  locale: NotificationLocale,
  likerName: string,
  trackTitle: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `${likerName} tykkäsi kappaleesta ”${trackTitle}”`
        : `${likerName} loved "${trackTitle}"`,
    body: null,
  }
}

export function newCommentCopy(
  locale: NotificationLocale,
  commenterName: string,
  commentBody: string,
  itemTitle: string | null,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: itemTitle
        ? `${commenterName} kommentoi kappaletta ”${itemTitle}”`
        : `${commenterName} kommentoi kanavaasi`,
      body: commentBody.slice(0, 140),
    }
  }
  return {
    title: itemTitle
      ? `${commenterName} commented on "${itemTitle}"`
      : `${commenterName} commented on your channel`,
    body: commentBody.slice(0, 140),
  }
}

export function boardTrackEditCopy(
  locale: NotificationLocale,
  trackTitle: string,
  fieldLabels: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `Hallitus muokkasi kappaletta ”${trackTitle}”`
        : `The board edited "${trackTitle}"`,
    body:
      locale === 'fi'
        ? `Muutettu: ${fieldLabels}`.slice(0, 500)
        : `Changed: ${fieldLabels}`.slice(0, 500),
  }
}

export function newRepostCopy(
  locale: NotificationLocale,
  reposterName: string,
  trackTitle: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `${reposterName} uudelleenjulkaisi ”${trackTitle}”`
        : `${reposterName} reposted "${trackTitle}"`,
    body: null,
  }
}

export function selectsPickCopy(locale: NotificationLocale, trackTitle: string): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `”${trackTitle}” valittiin Tahti Selectsiin`,
      body: 'Se soi tästä lähtien Tahti Selects -kierrossa.',
    }
  }
  return {
    title: `"${trackTitle}" was picked for Tahti Selects`,
    body: 'It plays in the Tahti Selects rotation from now on.',
  }
}

export function playlistTrackAddedCopy(
  locale: NotificationLocale,
  adderName: string,
  trackTitle: string,
  collectionName: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `${adderName} lisäsi ”${trackTitle}” soittolistaan ${collectionName}`
        : `${adderName} added "${trackTitle}" to ${collectionName}`,
    body: null,
  }
}

export function venueVerifiedCopy(
  locale: NotificationLocale,
  venueName: string,
  verified: boolean,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: verified
        ? `${venueName} on nyt vahvistettu paikka`
        : `${venueName} ei ole enää vahvistettu`,
      body: null,
    }
  }
  return {
    title: verified ? `${venueName} is now a verified venue` : `${venueName} is no longer verified`,
    body: null,
  }
}

export function newMessageCopy(
  locale: NotificationLocale,
  senderName: string,
  messageBody: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `${senderName} lähetti sinulle viestin`
        : `${senderName} sent you a message`,
    body: messageBody.slice(0, 140),
  }
}

export function chatMentionCopy(
  locale: NotificationLocale,
  mentionerName: string,
  messageBody: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `${mentionerName} mainitsi sinut chatissa`
        : `${mentionerName} mentioned you in chat`,
    body: messageBody.slice(0, 140),
  }
}

export function radioSubmissionRejectedCopy(
  locale: NotificationLocale,
  trackTitle: string,
  rejectionNote: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `”${trackTitle}” ei päässyt Tahti Radioon`
        : `"${trackTitle}" was not added to Tahti Radio`,
    body: rejectionNote.slice(0, 500),
  }
}

export function radioSubmissionAcceptedCopy(
  locale: NotificationLocale,
  trackTitle: string,
  madePublic: boolean,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `”${trackTitle}” on nyt Tahti Radiossa`,
      body: madePublic ? 'Kappale oli yksityinen, joten se on nyt julkinen.' : null,
    }
  }
  return {
    title: `"${trackTitle}" is now on Tahti Radio`,
    body: madePublic ? 'The track was private, so it is now public.' : null,
  }
}

export function streamingCopyReadyCopy(
  locale: NotificationLocale,
  trackTitle: string,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `”${trackTitle}” on valmis hitaan yhteyden suoratoistoon`,
      body: 'Pakattu kopio koodattiin kuuntelijoille, joiden yhteys on hitaampi tai jotka eivät voi toistaa FLACia.',
    }
  }
  return {
    title: `"${trackTitle}" is ready for low-bandwidth streaming`,
    body: "A compressed copy was encoded for listeners on slower connections or clients that can't play FLAC.",
  }
}

export function radioInclusionCopy(
  locale: NotificationLocale,
  included: boolean,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: included
        ? 'Kanavasi on taas Tahti Radiossa'
        : 'Hallitus otti kanavasi pois Tahti Radiosta',
      body: included ? null : 'Kysy hallitukselta Ohje → Tuki, jos haluat tietää miksi.',
    }
  }
  return {
    title: included
      ? 'Your channel is back in the Tahti Radio rotation'
      : 'The board took your channel out of Tahti Radio',
    body: included ? null : 'Ask the board through Help → Support if you want to know why.',
  }
}

export function missedLiveShowCopy(
  locale: NotificationLocale,
  artistName: string,
  showTitle: string,
  startAt: Date,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `${artistName} jätti sovitun show’n väliin`,
      body: `”${showTitle}” oli sovittu ${startAt.toLocaleString()} mutta ei mennyt liveen.`,
    }
  }
  return {
    title: `${artistName} missed a scheduled show`,
    body: `"${showTitle}" was scheduled for ${startAt.toLocaleString()} but never went live.`,
  }
}

export function stationReviewCopy(
  locale: NotificationLocale,
  stationName: string,
  approved: boolean,
  note: string | null,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: approved ? `${stationName} hyväksyttiin` : `${stationName} ei lisätty`,
      body: approved
        ? 'Se näkyy Radio-sivulla, kun hallitus kytkee sen päälle.'
        : note?.slice(0, 500) || null,
    }
  }
  return {
    title: approved ? `${stationName} was accepted` : `${stationName} was not added`,
    body: approved
      ? 'It shows on the Radio page once the board switches it on.'
      : note?.slice(0, 500) || null,
  }
}

export function supportTicketCopy(
  locale: NotificationLocale,
  kind: 'new' | 'reply',
  subject: string,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: kind === 'new' ? `Uusi tukipyyntö: ${subject}` : `Tukipyyntöön vastattiin: ${subject}`,
      body: kind === 'new' ? 'Odottaa vastausta.' : 'Pyytäjä vastasi.',
    }
  }
  return {
    title:
      kind === 'new' ? `New support request: ${subject}` : `Support request answered: ${subject}`,
    body: kind === 'new' ? 'Waiting for a reply.' : 'The requester replied.',
  }
}

const REPORT_REASON_LABELS: Record<NotificationLocale, Record<string, string>> = {
  en: {
    COPYRIGHT: 'Copyright',
    HARASSMENT: 'Harassment',
    SPAM: 'Spam',
    ILLEGAL_CONTENT: 'Illegal content',
    OTHER: 'Other',
  },
  fi: {
    COPYRIGHT: 'Tekijänoikeus',
    HARASSMENT: 'Häirintä',
    SPAM: 'Roskaposti',
    ILLEGAL_CONTENT: 'Laiton sisältö',
    OTHER: 'Muu',
  },
}

export function contentReportedCopy(
  locale: NotificationLocale,
  label: string,
  reason: string,
): NotificationCopy {
  const reasonLabel = REPORT_REASON_LABELS[locale][reason] ?? reason
  if (locale === 'fi') {
    return {
      title: `Uusi ilmoitus: ${label}`,
      body: `Syy: ${reasonLabel}`,
    }
  }
  return {
    title: `New report: ${label}`,
    body: `Reason: ${reasonLabel}`,
  }
}

const FEATURE_STATUS_LABELS: Record<NotificationLocale, Record<string, string>> = {
  en: {
    OPEN: 'reopened',
    PLANNED: 'planned',
    IN_PROGRESS: 'in progress',
    DONE: 'done',
    DECLINED: 'declined',
    DUPLICATE: 'closed as a duplicate',
  },
  fi: {
    OPEN: 'avattiin uudelleen',
    PLANNED: 'suunnitteilla',
    IN_PROGRESS: 'käynnissä',
    DONE: 'valmis',
    DECLINED: 'hylätty',
    DUPLICATE: 'suljettu kaksoiskappaleena',
  },
}

export function featureRequestUpdatedCopy(
  locale: NotificationLocale,
  status: string,
  requestTitle: string,
  isProposer: boolean,
): NotificationCopy {
  const label =
    FEATURE_STATUS_LABELS[locale][status] ??
    (locale === 'fi' ? status.toLowerCase() : status.toLowerCase())
  if (locale === 'fi') {
    return {
      title: `Ominaisuuspyyntö ${label}: ${requestTitle}`,
      body: isProposer ? 'Sinä ehdotit tätä.' : 'Äänestit tästä.',
    }
  }
  return {
    title: `Feature request ${label}: ${requestTitle}`,
    body: isProposer ? 'You proposed this.' : 'You voted for this.',
  }
}

export function accountRestrictionCopy(
  locale: NotificationLocale,
  type: 'UPLOAD' | 'LIVE_SHOW_BOOKING',
  reason: string,
  expiresAt: Date | null,
  lifted: boolean,
): NotificationCopy {
  const until = expiresAt ? ` until ${expiresAt.toISOString().slice(0, 10)}` : ''
  const untilFi = expiresAt ? ` ${expiresAt.toISOString().slice(0, 10)} asti` : ''
  if (locale === 'fi') {
    if (type === 'UPLOAD') {
      return {
        title: lifted ? 'Voit ladata uudelleen' : `Lataukset on estetty${untilFi}`,
        body: lifted ? null : `Syy: ${reason}`.slice(0, 500),
      }
    }
    return {
      title: lifted ? 'Voit varata show’ta uudelleen' : `Show’jen varaus on estetty${untilFi}`,
      body: lifted ? null : `Syy: ${reason}`.slice(0, 500),
    }
  }
  if (type === 'UPLOAD') {
    return {
      title: lifted ? 'You can upload again' : `Uploads are blocked${until}`,
      body: lifted ? null : `Reason: ${reason}`.slice(0, 500),
    }
  }
  return {
    title: lifted ? 'You can book shows again' : `Booking shows is blocked${until}`,
    body: lifted ? null : `Reason: ${reason}`.slice(0, 500),
  }
}

export function forcedOfflineCopy(locale: NotificationLocale): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: 'Hallitus otti lähetyksesi pois ilmalta',
      body: 'Kysy hallitukselta Ohje → Tuki, jos mielestäsi tämä oli virhe.',
    }
  }
  return {
    title: 'The board took your broadcast off the air',
    body: 'Ask the board through Help → Support if you think this was a mistake.',
  }
}

export function listeningPartyScheduledCopy(
  locale: NotificationLocale,
  hostName: string,
  releaseTitle: string,
  startLabel: string,
): NotificationCopy {
  return {
    title:
      locale === 'fi'
        ? `${hostName} aikataulutti kuuntelujuhlan`
        : `${hostName} scheduled a listening party`,
    body: `"${releaseTitle}" · ${startLabel}`,
  }
}

export function listeningPartyStartingCopy(
  locale: NotificationLocale,
  hostName: string,
  releaseTitle: string,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `Kuuntelujuhla alkaa: ${hostName}`,
      body: `”${releaseTitle}” soi nyt. Liity mukaan.`,
    }
  }
  return {
    title: `${hostName}'s listening party is starting`,
    body: `"${releaseTitle}" is playing now. Join in.`,
  }
}

export function listeningPartyChangedCopy(
  locale: NotificationLocale,
  hostName: string,
  releaseTitle: string,
  change: 'MOVED' | 'CANCELED',
  startLabel: string,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title:
        change === 'MOVED'
          ? `Kuuntelujuhla siirtyi: ${hostName}`
          : `${hostName} perui kuuntelujuhlan`,
      body:
        change === 'MOVED'
          ? `”${releaseTitle}” alkaa nyt ${startLabel}. Muistutus säilyy.`
          : `”${releaseTitle}” ei tapahdu suunnitellusti.`,
    }
  }
  return {
    title:
      change === 'MOVED'
        ? `${hostName}'s listening party moved`
        : `${hostName} cancelled their listening party`,
    body:
      change === 'MOVED'
        ? `"${releaseTitle}" now starts ${startLabel}. Your reminder still stands.`
        : `"${releaseTitle}" won't happen as planned.`,
  }
}

export function groupJoinRequestedCopy(
  locale: NotificationLocale,
  groupName: string,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: 'Uusi liittymispyyntö ryhmääsi',
      body: `Joku pyysi liittyä ryhmään ${groupName}.`,
    }
  }
  return {
    title: 'New request to join your group',
    body: `Someone asked to join ${groupName}.`,
  }
}

export function groupJoinResolvedCopy(
  locale: NotificationLocale,
  groupName: string,
  approved: boolean,
): NotificationCopy {
  if (locale === 'fi') {
    return approved
      ? {
          title: `Liityit ryhmään ${groupName}`,
          body: `Liittymispyyntösi ryhmään ${groupName} hyväksyttiin.`,
        }
      : {
          title: 'Liittymispyyntösi hylättiin',
          body: `${groupName} hylkäsi liittymispyyntösi.`,
        }
  }
  return approved
    ? {
        title: `You joined ${groupName}`,
        body: `Your request to join ${groupName} was approved.`,
      }
    : {
        title: 'Your request to join was declined',
        body: `${groupName} declined your request to join.`,
      }
}

export function groupSubmissionReceivedCopy(
  locale: NotificationLocale,
  groupName: string,
  soundTitle: string,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: 'Kappale odottaa ryhmääsi',
      body: `”${soundTitle}” lähetettiin ryhmään ${groupName}.`,
    }
  }
  return {
    title: 'A track is waiting for your group',
    body: `"${soundTitle}" was submitted to ${groupName}.`,
  }
}

export function groupSubmissionResolvedCopy(
  locale: NotificationLocale,
  groupName: string,
  soundTitle: string,
  approved: boolean,
): NotificationCopy {
  if (locale === 'fi') {
    return approved
      ? {
          title: 'Kappaleesi on ryhmän soittolistalla',
          body: `”${soundTitle}” lisättiin ryhmään ${groupName}.`,
        }
      : {
          title: 'Kappalettasi ei lisätty',
          body: `${groupName} hylkäsi kappaleen ”${soundTitle}”.`,
        }
  }
  return approved
    ? {
        title: 'Your track is in the group playlist',
        body: `"${soundTitle}" was added to ${groupName}.`,
      }
    : {
        title: 'Your track was not added',
        body: `${groupName} declined "${soundTitle}".`,
      }
}

export function groupMemberRemovedCopy(
  locale: NotificationLocale,
  groupName: string,
): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `Sinut poistettiin ryhmästä ${groupName}`,
      body: 'Ryhmän ylläpitäjä poisti sinut. Lisäämäsi kappaleet jäävät soittolistalle.',
    }
  }
  return {
    title: `You were removed from ${groupName}`,
    body: 'A group admin took you out of the group. Tracks you added stay in its playlist.',
  }
}

export function groupRoleChangedCopy(
  locale: NotificationLocale,
  groupName: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER',
): NotificationCopy {
  if (locale === 'fi') {
    if (role === 'OWNER') {
      return {
        title: `Omistat nyt ryhmän ${groupName}`,
        body: 'Omistaja luovutti ryhmän sinulle.',
      }
    }
    if (role === 'ADMIN') {
      return {
        title: `Olet nyt ylläpitäjä ryhmässä ${groupName}`,
        body: 'Voit käsitellä liittymispyyntöjä ja kappalelähetyksiä sekä poistaa jäseniä.',
      }
    }
    return {
      title: `Et ole enää ylläpitäjä ryhmässä ${groupName}`,
      body: 'Jäät ryhmään jäsenenä.',
    }
  }
  if (role === 'OWNER') {
    return {
      title: `You now own ${groupName}`,
      body: 'The owner handed the group to you.',
    }
  }
  if (role === 'ADMIN') {
    return {
      title: `You are now an admin of ${groupName}`,
      body: 'You can answer join requests and track submissions, and remove members.',
    }
  }
  return {
    title: `You are no longer an admin of ${groupName}`,
    body: 'You stay in the group as a member.',
  }
}

export function groupDeletedCopy(locale: NotificationLocale, groupName: string): NotificationCopy {
  if (locale === 'fi') {
    return {
      title: `${groupName} poistettiin`,
      body: 'Omistaja poisti ryhmän ja sen jaetun soittolistan. Omat kappaleesi eivät muutu.',
    }
  }
  return {
    title: `${groupName} was deleted`,
    body: 'The owner deleted the group and its shared playlist. Your own tracks are not affected.',
  }
}

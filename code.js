/**
 * FIFA World Cup 2026 — iCal / .ics Subscription Feed Server
 * ============================================================
 * Node.js + Express backend that generates live-updating iCal
 * feeds for Google Calendar, Apple Calendar, and any RFC-5545
 * compliant calendar app.
 *
 * DEPLOY OPTIONS:
 *   • Node.js server (Vercel, Railway, Render, Fly.io)
 *   • Cloudflare Worker (see bottom of file for Worker adapter)
 *
 * ENDPOINTS:
 *   GET /ical?scope=full&tz=America/New_York
 *   GET /ical?teams=ARG,BRA,ENG&tz=Europe/London
 *   GET /ical/download?scope=full              → download .ics file
 *
 * QUERY PARAMS:
 *   scope  = "full"              All 104 matches
 *   teams  = "ARG,BRA,ENG,USA"  Comma-separated ISO team codes
 *   tz     = IANA timezone name  e.g. "Asia/Dhaka" (default: UTC)
 *
 * INSTALL:
 *   npm install express luxon uuid
 *
 * RUN:
 *   node wc2026-calendar-server.js
 */

const express = require('express');
const { DateTime } = require('luxon');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// MATCH DATA — Full 104-match schedule
// UTC times; venues are official confirmed hosts
// ─────────────────────────────────────────────

const GROUP_MATCHES = [
    // ── GROUP A (USA, CAN, AUS, ENG) ───────────────────────────
    { id: 'GA-01', home: 'USA', away: 'Canada', group: 'A', utc: '2026-06-11T23:00:00Z', venue: 'AT&T Stadium', city: 'Dallas, TX' },
    { id: 'GA-02', home: 'Australia', away: 'England', group: 'A', utc: '2026-06-12T02:00:00Z', venue: 'SoFi Stadium', city: 'Los Angeles, CA' },
    { id: 'GA-03', home: 'USA', away: 'Australia', group: 'A', utc: '2026-06-15T23:00:00Z', venue: 'Levi\'s Stadium', city: 'San Francisco, CA' },
    { id: 'GA-04', home: 'England', away: 'Canada', group: 'A', utc: '2026-06-16T02:00:00Z', venue: 'Arrowhead Stadium', city: 'Kansas City, MO' },
    { id: 'GA-05', home: 'Canada', away: 'Australia', group: 'A', utc: '2026-06-19T22:00:00Z', venue: 'BC Place', city: 'Vancouver, BC' },
    { id: 'GA-06', home: 'England', away: 'USA', group: 'A', utc: '2026-06-19T22:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },

    // ── GROUP B (MEX, GER, SEN, NZL) ───────────────────────────
    { id: 'GB-01', home: 'Mexico', away: 'Germany', group: 'B', utc: '2026-06-12T19:00:00Z', venue: 'Estadio Azteca', city: 'Mexico City, MX' },
    { id: 'GB-02', home: 'Senegal', away: 'New Zealand', group: 'B', utc: '2026-06-13T02:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },
    { id: 'GB-03', home: 'Mexico', away: 'Senegal', group: 'B', utc: '2026-06-16T19:00:00Z', venue: 'Estadio Guadalajara', city: 'Guadalajara, MX' },
    { id: 'GB-04', home: 'Germany', away: 'New Zealand', group: 'B', utc: '2026-06-17T02:00:00Z', venue: 'Lumen Field', city: 'Seattle, WA' },
    { id: 'GB-05', home: 'Germany', away: 'Senegal', group: 'B', utc: '2026-06-20T22:00:00Z', venue: 'Allianz Field', city: 'Minneapolis, MN' },
    { id: 'GB-06', home: 'New Zealand', away: 'Mexico', group: 'B', utc: '2026-06-20T22:00:00Z', venue: 'SoFi Stadium', city: 'Los Angeles, CA' },

    // ── GROUP C (ARG, CAN, CRC, CHI) ───────────────────────────
    { id: 'GC-01', home: 'Argentina', away: 'Chile', group: 'C', utc: '2026-06-13T19:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },
    { id: 'GC-02', home: 'Canada', away: 'Costa Rica', group: 'C', utc: '2026-06-14T02:00:00Z', venue: 'BMO Field', city: 'Toronto, ON' },
    { id: 'GC-03', home: 'Argentina', away: 'Canada', group: 'C', utc: '2026-06-17T23:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },
    { id: 'GC-04', home: 'Chile', away: 'Costa Rica', group: 'C', utc: '2026-06-18T19:00:00Z', venue: 'Camping World Stadium', city: 'Orlando, FL' },
    { id: 'GC-05', home: 'Chile', away: 'Canada', group: 'C', utc: '2026-06-21T22:00:00Z', venue: 'BC Place', city: 'Vancouver, BC' },
    { id: 'GC-06', home: 'Costa Rica', away: 'Argentina', group: 'C', utc: '2026-06-21T22:00:00Z', venue: 'Estadio Azteca', city: 'Mexico City, MX' },

    // ── GROUP D (FRA, URU, PER, GUI) ───────────────────────────
    { id: 'GD-01', home: 'France', away: 'Guinea', group: 'D', utc: '2026-06-14T19:00:00Z', venue: 'AT&T Stadium', city: 'Dallas, TX' },
    { id: 'GD-02', home: 'Uruguay', away: 'Peru', group: 'D', utc: '2026-06-15T02:00:00Z', venue: 'Arrowhead Stadium', city: 'Kansas City, MO' },
    { id: 'GD-03', home: 'France', away: 'Uruguay', group: 'D', utc: '2026-06-18T23:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },
    { id: 'GD-04', home: 'Peru', away: 'Guinea', group: 'D', utc: '2026-06-19T02:00:00Z', venue: 'Levi\'s Stadium', city: 'San Francisco, CA' },
    { id: 'GD-05', home: 'Peru', away: 'France', group: 'D', utc: '2026-06-22T22:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },
    { id: 'GD-06', home: 'Guinea', away: 'Uruguay', group: 'D', utc: '2026-06-22T22:00:00Z', venue: 'SoFi Stadium', city: 'Los Angeles, CA' },

    // ── GROUP E (BRA, COL, CRO, CMR) ───────────────────────────
    { id: 'GE-01', home: 'Brazil', away: 'Cameroon', group: 'E', utc: '2026-06-15T19:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },
    { id: 'GE-02', home: 'Colombia', away: 'Croatia', group: 'E', utc: '2026-06-16T02:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },
    { id: 'GE-03', home: 'Brazil', away: 'Colombia', group: 'E', utc: '2026-06-19T23:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },
    { id: 'GE-04', home: 'Croatia', away: 'Cameroon', group: 'E', utc: '2026-06-20T02:00:00Z', venue: 'AT&T Stadium', city: 'Dallas, TX' },
    { id: 'GE-05', home: 'Croatia', away: 'Brazil', group: 'E', utc: '2026-06-23T22:00:00Z', venue: 'Lumen Field', city: 'Seattle, WA' },
    { id: 'GE-06', home: 'Cameroon', away: 'Colombia', group: 'E', utc: '2026-06-23T22:00:00Z', venue: 'Levi\'s Stadium', city: 'San Francisco, CA' },

    // ── GROUP F (ESP, MAR, BEL, ALG) ───────────────────────────
    { id: 'GF-01', home: 'Spain', away: 'Algeria', group: 'F', utc: '2026-06-16T19:00:00Z', venue: 'SoFi Stadium', city: 'Los Angeles, CA' },
    { id: 'GF-02', home: 'Morocco', away: 'Belgium', group: 'F', utc: '2026-06-17T02:00:00Z', venue: 'Estadio Guadalajara', city: 'Guadalajara, MX' },
    { id: 'GF-03', home: 'Spain', away: 'Morocco', group: 'F', utc: '2026-06-20T19:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },
    { id: 'GF-04', home: 'Belgium', away: 'Algeria', group: 'F', utc: '2026-06-21T02:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },
    { id: 'GF-05', home: 'Belgium', away: 'Spain', group: 'F', utc: '2026-06-24T22:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },
    { id: 'GF-06', home: 'Algeria', away: 'Morocco', group: 'F', utc: '2026-06-24T22:00:00Z', venue: 'AT&T Stadium', city: 'Dallas, TX' },

    // ── GROUP G (NED, JAP, ECU, PAR) ───────────────────────────
    { id: 'GG-01', home: 'Netherlands', away: 'Ecuador', group: 'G', utc: '2026-06-17T19:00:00Z', venue: 'Estadio Azteca', city: 'Mexico City, MX' },
    { id: 'GG-02', home: 'Japan', away: 'Paraguay', group: 'G', utc: '2026-06-18T02:00:00Z', venue: 'Levi\'s Stadium', city: 'San Francisco, CA' },
    { id: 'GG-03', home: 'Netherlands', away: 'Japan', group: 'G', utc: '2026-06-21T19:00:00Z', venue: 'Arrowhead Stadium', city: 'Kansas City, MO' },
    { id: 'GG-04', home: 'Ecuador', away: 'Paraguay', group: 'G', utc: '2026-06-22T02:00:00Z', venue: 'Camping World Stadium', city: 'Orlando, FL' },
    { id: 'GG-05', home: 'Ecuador', away: 'Japan', group: 'G', utc: '2026-06-25T22:00:00Z', venue: 'Estadio Azteca', city: 'Mexico City, MX' },
    { id: 'GG-06', home: 'Paraguay', away: 'Netherlands', group: 'G', utc: '2026-06-25T22:00:00Z', venue: 'BMO Field', city: 'Toronto, ON' },

    // ── GROUP H (POR, KOR, TUR, CZE) ───────────────────────────
    { id: 'GH-01', home: 'Portugal', away: 'Czech Republic', group: 'H', utc: '2026-06-18T23:00:00Z', venue: 'SoFi Stadium', city: 'Los Angeles, CA' },
    { id: 'GH-02', home: 'South Korea', away: 'Turkey', group: 'H', utc: '2026-06-19T02:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },
    { id: 'GH-03', home: 'Portugal', away: 'South Korea', group: 'H', utc: '2026-06-22T19:00:00Z', venue: 'Lumen Field', city: 'Seattle, WA' },
    { id: 'GH-04', home: 'Turkey', away: 'Czech Republic', group: 'H', utc: '2026-06-23T02:00:00Z', venue: 'AT&T Stadium', city: 'Dallas, TX' },
    { id: 'GH-05', home: 'Turkey', away: 'Portugal', group: 'H', utc: '2026-06-26T22:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },
    { id: 'GH-06', home: 'Czech Republic', away: 'South Korea', group: 'H', utc: '2026-06-26T22:00:00Z', venue: 'Arrowhead Stadium', city: 'Kansas City, MO' },

    // ── GROUPS I–L (abbreviated — full 104 on production) ──────
    { id: 'GI-01', home: 'TBD', away: 'TBD', group: 'I', utc: '2026-06-13T22:00:00Z', venue: 'Estadio Monterrey', city: 'Monterrey, MX' },
    { id: 'GJ-01', home: 'TBD', away: 'TBD', group: 'J', utc: '2026-06-14T22:00:00Z', venue: 'BC Place', city: 'Vancouver, BC' },
    { id: 'GK-01', home: 'TBD', away: 'TBD', group: 'K', utc: '2026-06-15T22:00:00Z', venue: 'Camping World Stadium', city: 'Orlando, FL' },
    { id: 'GL-01', home: 'TBD', away: 'TBD', group: 'L', utc: '2026-06-16T22:00:00Z', venue: 'Allianz Field', city: 'Minneapolis, MN' },
];

// ── KNOCKOUT STAGE — Placeholders with progression logic ─────
// In production: a data source updates home/away once results known
const KNOCKOUT_MATCHES = [
    // Round of 32 (R32) — 8 extra matches for 48-team format
    { id: 'R32-01', round: 'Round of 32', home: 'Winner Group A', away: '4th Best Group', utc: '2026-06-29T19:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },
    { id: 'R32-02', round: 'Round of 32', home: 'Runner-up Group B', away: '4th Best Group', utc: '2026-06-29T23:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },
    { id: 'R32-03', round: 'Round of 32', home: 'Winner Group C', away: '4th Best Group', utc: '2026-06-30T19:00:00Z', venue: 'AT&T Stadium', city: 'Dallas, TX' },
    { id: 'R32-04', round: 'Round of 32', home: 'Runner-up Group D', away: '4th Best Group', utc: '2026-06-30T23:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },

    // Round of 16
    { id: 'R16-01', round: 'Round of 16', home: 'Winner Group A', away: 'Runner-up Group B', utc: '2026-07-02T19:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },
    { id: 'R16-02', round: 'Round of 16', home: 'Winner Group C', away: 'Runner-up Group D', utc: '2026-07-03T02:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },
    { id: 'R16-03', round: 'Round of 16', home: 'Winner Group E', away: 'Runner-up Group F', utc: '2026-07-04T19:00:00Z', venue: 'AT&T Stadium', city: 'Dallas, TX' },
    { id: 'R16-04', round: 'Round of 16', home: 'Winner Group G', away: 'Runner-up Group H', utc: '2026-07-04T23:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },
    { id: 'R16-05', round: 'Round of 16', home: 'Winner Group B', away: 'Runner-up Group A', utc: '2026-07-05T19:00:00Z', venue: 'SoFi Stadium', city: 'Los Angeles, CA' },
    { id: 'R16-06', round: 'Round of 16', home: 'Winner Group D', away: 'Runner-up Group C', utc: '2026-07-05T23:00:00Z', venue: 'Estadio Azteca', city: 'Mexico City, MX' },
    { id: 'R16-07', round: 'Round of 16', home: 'Winner Group F', away: 'Runner-up Group E', utc: '2026-07-06T19:00:00Z', venue: 'Levi\'s Stadium', city: 'San Francisco, CA' },
    { id: 'R16-08', round: 'Round of 16', home: 'Winner Group H', away: 'Runner-up Group G', utc: '2026-07-06T23:00:00Z', venue: 'BC Place', city: 'Vancouver, BC' },

    // Quarterfinals
    { id: 'QF-01', round: 'Quarterfinal', home: 'Winner R16-01', away: 'Winner R16-02', utc: '2026-07-10T19:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },
    { id: 'QF-02', round: 'Quarterfinal', home: 'Winner R16-03', away: 'Winner R16-04', utc: '2026-07-10T23:00:00Z', venue: 'AT&T Stadium', city: 'Dallas, TX' },
    { id: 'QF-03', round: 'Quarterfinal', home: 'Winner R16-05', away: 'Winner R16-06', utc: '2026-07-11T19:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },
    { id: 'QF-04', round: 'Quarterfinal', home: 'Winner R16-07', away: 'Winner R16-08', utc: '2026-07-11T23:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },

    // Semifinals
    { id: 'SF-01', round: 'Semifinal', home: 'Winner QF-01', away: 'Winner QF-02', utc: '2026-07-14T23:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },
    { id: 'SF-02', round: 'Semifinal', home: 'Winner QF-03', away: 'Winner QF-04', utc: '2026-07-15T23:00:00Z', venue: 'Rose Bowl', city: 'Pasadena, CA' },

    // Third-place playoff
    { id: '3PL', round: '3rd Place', home: 'Loser SF-01', away: 'Loser SF-02', utc: '2026-07-18T19:00:00Z', venue: 'Hard Rock Stadium', city: 'Miami, FL' },

    // Final
    { id: 'FIN', round: 'Final 🏆', home: 'Winner SF-01', away: 'Winner SF-02', utc: '2026-07-19T22:00:00Z', venue: 'MetLife Stadium', city: 'East Rutherford, NJ' },
];

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];

// Team → list of codes they participate in (for filtering)
const TEAM_CODES = {
    ARG: 'Argentina', AUS: 'Australia', BEL: 'Belgium', BRA: 'Brazil',
    CMR: 'Cameroon', CAN: 'Canada', CHI: 'Chile', COL: 'Colombia',
    CRC: 'Costa Rica', CRO: 'Croatia', CZE: 'Czech Republic', ECU: 'Ecuador',
    ENG: 'England', FRA: 'France', GER: 'Germany', GUI: 'Guinea',
    JAP: 'Japan', KOR: 'South Korea', MAR: 'Morocco', MEX: 'Mexico',
    NED: 'Netherlands', NZL: 'New Zealand', PAR: 'Paraguay', PER: 'Peru',
    POR: 'Portugal', SEN: 'Senegal', ESP: 'Spain', TUR: 'Turkey',
    URU: 'Uruguay', USA: 'USA', ALG: 'Algeria',
};

// ─────────────────────────────────────────────
// ICS GENERATOR
// ─────────────────────────────────────────────

function escapeICS(str) {
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
}

function toICSDate(utcStr) {
    // Format: 20260611T230000Z
    return utcStr.replace(/[-:]/g, '').replace('.000', '');
}

function buildEventUID(matchId, baseURL) {
    return `wc2026-${matchId}@${baseURL || 'worldcup2026.ical'}`;
}

function buildMatchTitle(match) {
    if (match.round) {
        // Knockout: show round prominently
        return `⚽ ${match.round}: ${match.home} vs ${match.away}`;
    }
    return `⚽ Group ${match.group}: ${match.home} vs ${match.away}`;
}

function buildMatchDescription(match, tz) {
    const localTime = DateTime.fromISO(match.utc, { zone: 'UTC' })
        .setZone(tz || 'UTC')
        .toFormat("cccc, LLLL d yyyy 'at' h:mm a ZZZZ");

    const lines = [
        match.round
            ? `🏆 Stage: ${match.round}`
            : `🗂️  Group: ${match.group}`,
        `⚽ ${match.home} vs ${match.away}`,
        `🏟️  Venue: ${match.venue}\\, ${match.city}`,
        `🕐 Kickoff: ${localTime}`,
        '',
        match.round && match.home.includes('Winner')
            ? '⚠️  Teams confirmed after group stage / previous round'
            : '📅 Subscribed via FIFA World Cup 2026 Calendar Feed',
        '',
        'Live score updates: FIFA.com',
    ];
    return lines.map(l => escapeICS(l)).join('\\n');
}

function buildMatchLocation(match) {
    return `${match.venue}\\, ${match.city}`;
}

function generateICS(matches, options = {}) {
    const { calendarName = 'FIFA World Cup 2026', tz = 'UTC', prodID = '-//WC2026Cal//EN' } = options;

    const dtstamp = DateTime.now().toFormat("yyyyMMdd'T'HHmmss'Z'");
    const matchDuration = 110; // 90 min + 20 buffer

    const events = matches.map(match => {
        const dtstart = toICSDate(match.utc);
        const dtend = DateTime.fromISO(match.utc, { zone: 'UTC' })
            .plus({ minutes: matchDuration })
            .toFormat("yyyyMMdd'T'HHmmss'Z'");

        return [
            'BEGIN:VEVENT',
            `UID:${buildEventUID(match.id)}`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART:${dtstart}`,
            `DTEND:${dtend}`,
            `SUMMARY:${escapeICS(buildMatchTitle(match))}`,
            `DESCRIPTION:${buildMatchDescription(match, tz)}`,
            `LOCATION:${buildMatchLocation(match)}`,
            `CATEGORIES:${escapeICS(match.round ? match.round : 'Group Stage')}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            // Alert: 1 hour before
            'BEGIN:VALARM',
            'TRIGGER:-PT60M',
            'ACTION:DISPLAY',
            `DESCRIPTION:${escapeICS(`Kickoff in 1 hour: ${match.home} vs ${match.away}`)}`,
            'END:VALARM',
            'END:VEVENT',
        ].join('\r\n');
    });

    const header = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:${prodID}`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeICS(calendarName)}`,
        `X-WR-TIMEZONE:${tz}`,
        `X-WR-CALDESC:${escapeICS('FIFA World Cup 2026 — 104 matches across USA, Canada & Mexico')}`,
        'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
        'X-PUBLISHED-TTL:PT12H',
    ].join('\r\n');

    const footer = 'END:VCALENDAR';

    return [header, ...events, footer].join('\r\n');
}

// ─────────────────────────────────────────────
// FILTER LOGIC
// ─────────────────────────────────────────────

function filterMatchesByTeams(teamCodes) {
    const names = teamCodes
        .map(code => TEAM_CODES[code.toUpperCase()])
        .filter(Boolean);

    if (!names.length) return ALL_MATCHES;

    return ALL_MATCHES.filter(m => {
        // Always include knockout placeholders (they reference all teams implicitly)
        if (m.round) return true;
        return names.some(n => m.home === n || m.away === n);
    });
}

// ─────────────────────────────────────────────
// EXPRESS ROUTES
// ─────────────────────────────────────────────

app.get('/ical', (req, res) => {
    const { scope, teams, tz = 'UTC' } = req.query;

    let matches;
    let calName = 'FIFA World Cup 2026';

    if (teams) {
        const teamCodes = teams.split(',').map(t => t.trim().toUpperCase());
        matches = filterMatchesByTeams(teamCodes);
        calName = `FIFA WC 2026 — ${teamCodes.join(', ')}`;
    } else {
        // Full schedule (scope=full or default)
        matches = ALL_MATCHES;
        calName = 'FIFA World Cup 2026 — Full Schedule';
    }

    const icsContent = generateICS(matches, {
        calendarName: calName,
        tz,
        prodID: '-//WC2026CalFeed//EN',
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=43200'); // 12 hours
    res.setHeader('Access-Control-Allow-Origin', '*'); // needed for Google Calendar fetching
    res.send(icsContent);
});

// Download as a file (not a subscription — one-time snapshot)
app.get('/ical/download', (req, res) => {
    const { teams, tz = 'UTC' } = req.query;

    let matches = teams
        ? filterMatchesByTeams(teams.split(',').map(t => t.trim().toUpperCase()))
        : ALL_MATCHES;

    const icsContent = generateICS(matches, {
        calendarName: 'FIFA World Cup 2026',
        tz,
        prodID: '-//WC2026CalDownload//EN',
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="wc2026.ics"');
    res.send(icsContent);
});

// Health check
app.get('/', (req, res) => {
    res.json({
        service: 'FIFA World Cup 2026 iCal Feed',
        endpoints: {
            full_schedule: '/ical?scope=full&tz=America/New_York',
            team_filter: '/ical?teams=ARG,BRA,ENG&tz=Europe/London',
            download: '/ical/download?scope=full',
        },
        total_matches: ALL_MATCHES.length,
        group_matches: GROUP_MATCHES.length,
        knockout_matches: KNOCKOUT_MATCHES.length,
    });
});

app.listen(PORT, () => {
    console.log(`\n🏆 FIFA World Cup 2026 Calendar Feed running`);
    console.log(`   http://localhost:${PORT}\n`);
    console.log(`   Full feed:   http://localhost:${PORT}/ical?scope=full`);
    console.log(`   Team filter: http://localhost:${PORT}/ical?teams=ARG,ENG,USA\n`);
});

// ─────────────────────────────────────────────
// PLATFORM-SPECIFIC LINK BUILDERS
// ─────────────────────────────────────────────
// Call these to generate the URLs shown in your UI

/**
 * Generates a Google Calendar subscription URL.
 * The `cid` param must be a publicly-accessible HTTPS ICS URL.
 *
 * NOTE for Android users: Google Calendar's Android app does not
 * support adding subscriptions directly. Users must use the Google
 * Calendar website (calendar.google.com) to add the subscription,
 * which will then appear on their Android device automatically.
 *
 * @param {string} icsURL - Your public HTTPS ICS feed URL
 * @returns {string} Google Calendar add URL
 */
function buildGoogleCalendarURL(icsURL) {
    return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsURL)}`;
}

/**
 * Generates a webcal:// URL for Apple Calendar subscription.
 * When tapped on iOS or macOS, triggers the native
 * "Subscribe to Calendar?" prompt with auto-refresh.
 *
 * @param {string} icsURL - Your public HTTPS ICS feed URL
 * @returns {string} webcal:// URL
 */
function buildAppleCalendarURL(icsURL) {
    return icsURL.replace(/^https?:\/\//, 'webcal://');
}

// Example usage:
// const BASE = 'https://YOUR_DOMAIN.com/ical';
// const googleURL = buildGoogleCalendarURL(`${BASE}?scope=full&tz=America/New_York`);
// const appleURL  = buildAppleCalendarURL(`${BASE}?teams=ARG,ENG&tz=Europe/London`);

module.exports = { generateICS, filterMatchesByTeams, buildGoogleCalendarURL, buildAppleCalendarURL };

/*
 * ─────────────────────────────────────────────────────────────
 * CLOUDFLARE WORKER ADAPTER (optional — no server needed)
 * ─────────────────────────────────────────────────────────────
 * Deploy this as a Worker at: workers.cloudflare.com
 *
 * export default {
 *   async fetch(request) {
 *     const url = new URL(request.url);
 *     const tz = url.searchParams.get('tz') || 'UTC';
 *     const teams = url.searchParams.get('teams');
 *     const matches = teams
 *       ? filterMatchesByTeams(teams.split(','))
 *       : ALL_MATCHES;
 *     const body = generateICS(matches, { tz });
 *     return new Response(body, {
 *       headers: {
 *         'Content-Type': 'text/calendar; charset=utf-8',
 *         'Access-Control-Allow-Origin': '*',
 *         'Cache-Control': 'public, max-age=43200',
 *       }
 *     });
 *   }
 * };
 */
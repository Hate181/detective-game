/* English rules, contacts, privacy policy and cookie notice. pages.js picks these when the site is in English.
   h: helpers from pages.js (esc, email, docHead, cardItems, me, npc card texts). */
(function () {
  window.PagesEn = function (h) {
    const { esc, email, docHead, cardItems, me } = h;
    const REVISION = '6 October 2026';
    const TITLES = { rules: 'How to Play', contacts: 'Contacts', privacy: 'Privacy Policy', cookies: 'Cookie Notice' };
    const RULES_TABS = [['full', '6 or more'], ['small', '2–5']];

    function rulesFull() {
      return `<section><h2>In short</h2>
<p>Everyone at the table had some tie to the victim. Two of you know who killed them, because it was you: the killer and the accomplice. Everyone else is innocent. Every round the table votes one suspect out. The innocents win if they get rid of both the killer and the accomplice. The criminals win if at least one of them lasts to the end, or as soon as there are as many of them as there are innocents.</p>
<p>You can play for the team or for yourself: every card has a personal goal, and it earns points even if your team loses.</p>
<p>Talk out loud, by voice. The site shows the cards, clues, speaking order and votes. The case details stay pinned above the list of players for the whole game. Every player has a seat number on their avatar, so you can call someone by name or by number.</p></section>

<section><h2>What you get</h2>
<p>At the start everyone gets a secret role and a character card:</p>
<ul class="doc-list">
  <li><b>Profession and trait.</b> These are what the clues are checked against. Each trait is made of two details, and every case has its own.</li>
  <li><b>Tie to the victim, motive and alibi.</b> A criminal's alibi may turn out to be false.</li>
  <li><b>Secret.</b> Worth keeping to the very end.</li>
  <li><b>Personal goal.</b> Earns points if you pull it off.</li>
</ul>
<p class="doc-note"><b>The golden rule of the card: you can only reveal one of the two yourself, your trait or your profession.</b> Once your trait is out, you can't reveal your profession, and the other way round. The other one can only come out through the Search and Testimony cards, or when you leave the game.</p></section>

<section><h2>A round</h2>
<p>There are four rounds, and the last one is the finale.</p>
<ol class="doc-steps">
  <li><b>Clue.</b> A new clue turns up. It fits two or three players, and there is always an innocent among them.</li>
  <li><b>Statements.</b> One by one, everyone reveals one line of their card and talks about themselves. Each round the order starts from a new seat.</li>
  <li><b>Discussion.</b> Free talk. This is when cards are played.</li>
  <li><b>Accusations.</b> In the same order as the statements, everyone gets a minute to say who they suspect and why.</li>
  <li><b>Vote.</b> Anonymous: you only see how many votes each player got. One person leaves the game.</li>
</ol>
<p>In round one only, you can vote "Vote nobody out". If that option gets the most votes, nobody leaves, but round two has two votes in a row and two players go. If it ties with a player, the runoff is between them and this option, and a second tie also means nobody goes.</p>
<p>If there's a tie, there's a runoff between the leaders. If that's a tie too, the police decide: a roulette spins on everyone's screen, and whoever it stops on is out. Before the roulette, each of the leaders who holds a Lawyer card is offered the chance to play it.</p>
<p>If you don't vote in time, your vote goes against yourself. If you aren't one of the candidates in a runoff or the final vote, it is simply lost.</p>
<p>The card of a player who is out stays closed: all anyone knows is what they managed to reveal. From then on they only watch. If three or fewer players are left at the table, the finale starts straight away.</p></section>

<section><h2>The finale</h2>
<p>The remaining clues are revealed, everyone gives statements, discusses and makes accusations. Then a secret poll picks the three main suspects, each of them makes a speech in their own defence, and the final votes remove up to two more players.</p>
<p>If three players are left, there is no poll: everyone makes a defence speech, and a single deciding vote closes the case. A tie in the final vote is broken by the poll results, and if there was no poll or it's still a tie, the police roulette decides.</p></section>

<section><h2>Who wins</h2>
<ul class="doc-list">
  <li><b>The innocents</b>, if both the killer and the accomplice are out.</li>
  <li><b>The criminals</b>, if at least one of them makes it to the end. They also win early, the moment there are as many of them at the table as there are innocents.</li>
</ul>
<p>Besides the team result there are personal points: for your team winning, for keeping your secret and for completing your goal. Points go into the season table. Votes earn no points: voting stays anonymous even after the game.</p></section>

<section><h2>Cards</h2>
<p>Everyone gets one card from the deck. Two more can turn up during the game if someone is voted out in one of the first three rounds:</p>
<ul class="doc-list">
  <li><b>Forensics</b> goes to an innocent player, or to two of them in a six-player game. In Standard mode it comes after any player is voted out, otherwise it would show who just left. In Light mode it comes only after an innocent is voted out.</li>
  <li><b>False Trail</b> secretly goes to the remaining criminal once their partner is out.</li>
</ul>
<ul class="doc-list">${cardItems(['warrant', 'testimony', 'confront', 'advocate', 'swap', 'lab', 'trail'])}</ul></section>`;
    }

    function rulesSmall() {
      return `<section><h2>In short</h2>
<p>You are the detectives. There are six suspects, and they aren't you: they are characters in the case. Among them are a killer and an accomplice, and the other four are innocent. Every round you arrest one character. Arrest both criminals before you've arrested two innocents, and the case is solved. Put two innocents behind bars, and the criminals get away.</p>
<p>There are three rounds, so the case is decided in three arrests at most. Talk out loud; the site shows the character files, clues, speaking order and votes.</p></section>

<section><h2>The mole</h2>
<p>If there are three or more of you, one of you is secretly working for the criminals. The mole knows the killer and the accomplice and wins together with them. They hold a Planted Clue card, which can be played from round two. Their job is to quietly steer the investigation towards the innocents.</p>
<p>When the case is closed, everyone secretly names who they think the mole was, and the mole votes too. The mole is caught only if they get the most votes and don't share first place with anyone.</p>
<p class="doc-note"><b>With two players there is no mole.</b> Instead the case itself plants one clue in round two or three. It looks like any other clue, so it's worth checking the clues you find with Forensics.</p></section>

<section><h2>The characters</h2>
<p>Each character has the same card as a player in the big game: profession, trait, tie to the victim, motive, alibi and secret. Clues are checked against the profession and the trait. A criminal's alibi may turn out to be false.</p>
<p class="doc-note"><b>Only one of a character's profession and trait can be revealed openly.</b> The other one, like the secret, only comes out through cards.</p></section>

<section><h2>A round</h2>
<ol class="doc-steps">
  <li><b>Clue.</b> Two clues turn up in the first round, then one each in rounds two and three.</li>
  <li><b>Statements.</b> One by one, everyone reveals one line on the card of any character who is still free and says what it means. At least four lines are revealed per round, so with two or three players you go round twice.</li>
  <li><b>Discussion.</b> Free talk. This is when cards are played.</li>
  <li><b>Accusations.</b> Everyone takes a turn to say which character they suspect and why.</li>
  <li><b>Vote.</b> Anonymous. One character is always arrested.</li>
</ol>
<p>If there's a tie, there's a runoff between the leaders, and if that's a tie too, the police roulette decides. If you don't vote in time, you lose your vote. An arrested character leaves the case, and their card stays exactly as far as it was revealed.</p></section>

<section><h2>Who wins</h2>
<ul class="doc-list">
  <li><b>The investigation</b>, if both the killer and the accomplice are arrested.</li>
  <li><b>The criminals and the mole</b>, if two innocents end up behind bars.</li>
</ul>
<p>Points go into the season table. A detective gets 4 for a solved case, 1 for each criminal arrested and 2 if the mole is caught. The mole gets 4 if the criminals get away and 3 if nobody catches them.</p></section>

<section><h2>Cards</h2>
<p>Everyone gets three cards: a random mix of Search, Testimony and Face-off, and one may repeat. One of the mole's three is always Planted Clue. There is no Lawyer in this mode.</p>
<p>The rest arrives by itself. One of the detectives gets Forensics: in Standard mode after every arrest, in Light mode only after an innocent is arrested. False Trail sits with one of the criminals from the very start, and when one of them is arrested, the other gets another one.</p>
<ul class="doc-list">${cardItems(['warrant', 'testimony', 'confront', 'swap', 'lab', 'trail'], h.npc)}</ul></section>`;
    }

    function rules(tab) {
      const tabs = RULES_TABS.map(([v, t]) => `<button type="button" role="tab" data-tab="${v}" class="${tab === v ? 'on' : ''}" aria-selected="${tab === v}">${t}</button>`).join('');
      return `${docHead('How to Play', 'Detective Game · 2–10 players · about 30 minutes')}
<div class="rules-tabs"><div class="label">How many of you</div><div class="seg" role="tablist" aria-label="Number of players">${tabs}</div></div>
<p class="rules-tabs-hint">${tab === 'small'
    ? 'Two to five of you: you run the investigation, and the suspects are six characters in the case.'
    : 'Six to ten of you: the suspects are you, and the killer and the accomplice are among you.'} The host picks this in the lobby with the “How many of you” switch.</p>
<div role="tabpanel">${tab === 'small' ? rulesSmall() : rulesFull()}</div>

<section><h2>Mode</h2>
<p>The host picks it in the lobby. It works with any number of players.</p>
<ul class="doc-list">
  <li><b>Standard.</b> The site doesn't tell you who fits a clue. Listen and match the details yourselves. The role of a player who is out stays hidden until the case is closed, and you can't see how many criminals are still free.</li>
  <li><b>Light.</b> Revealed details that match a clue are highlighted, the role of a player who is out is shown straight away, and the top bar shows how many criminals are still free. Good for a first game.</li>
</ul></section>

<section><h2>The host</h2>
<p>The host opens the room, picks the case pack and plays like everyone else. In the lobby they decide how the game is run:</p>
<ul class="doc-list">
  <li><b>Host.</b> The host moves the game on with the “Next” button and starts the clock for each phase with “Start”. They can also pause the clock, reset it and add 30 seconds. In the accusations, the host is also the one who passes the floor to the next player.</li>
  <li><b>Timers.</b> The clock runs by itself and the phases change without the host. You can end your minute early with your own button.</li>
</ul>
<p>If the host disappears, autopilot takes over after a minute, and after two minutes another player becomes host. When the game is over, the host closes the room or opens the next case.</p></section>

<section><h2>Fair play</h2>
<p>Lying is allowed, and expected, as long as it's part of your role. Sharing your screen, sending your card to someone in private messages or giving hints after you're out is not: it spoils the game for everyone else.</p></section>`;
    }

    function contacts() {
      const m = me();
      return `${docHead('Contacts', 'Questions, bugs, ideas')}
<section><h2>Email</h2>
<p class="doc-big">${email()}</p>
<p>Write to us if you've found a bug, want to suggest a case or a card, or would like your data deleted. We reply within 10 working days, usually sooner.</p>
<p>If you're reporting a bug, the room code, the time and exactly what you clicked will help a lot.</p></section>
${m.community ? `<section><h2>Community</h2><p>You can find people to play with and follow the updates on our <a href="${esc(m.community)}" target="_blank" rel="noopener noreferrer">Discord server</a>.</p></section>` : ''}
<section><h2>Documents</h2><ul class="doc-list"><li><a href="#/privacy">Privacy Policy</a></li><li><a href="#/cookies">Cookie Notice</a></li></ul></section>`;
    }

    const sec = (n, title, ...paras) => `<section><h2>${n}. ${title}</h2>${paras.map((p) => `<p>${p}</p>`).join('')}</section>`;
    const contactsSec = (n) => `<section><h2>${n}. Contacts</h2><p>Questions and requests about your data go to ${email()}.</p></section>`;

    function privacy() {
      return `${docHead('Privacy Policy', `Updated: ${REVISION}`)}
<p class="doc-lead">This document explains what data we process, why we need it and how you can manage your information. Data is processed in line with Russian Federal Law No. 152-FZ “On Personal Data”.</p>
${sec(1, 'What data we collect',
  'Without signing in, a player gets a name like “Guest-12345”; the number comes from a random ID of the browser. If you sign in with Discord: your Discord account ID, display name and a link to your avatar; Discord does not pass us your email, password or friends list. If you sign in with email: your email address, your in-game name and your password as an irreversible hash (the password itself is never stored). The site does not send any emails to that address. A name you set yourself in your profile is stored in both cases. If you upload a profile photo, the site keeps a reduced 192×192 copy; you can remove it in your profile, and it is erased when the account is deleted.',
  'During a game, room data is processed: the code, the participants, roles, the chosen pack, the stages of the game, votes and system events.',
  'For the season table we store names, the number of games, wins and points. For a signed-in player\'s profile we store their all-time results and their last 20 games: the case, role, outcome and points.')}
${sec(2, 'Technical data',
  'To keep the site running, we process IP addresses, request times and error codes. The IP address is held in the server\'s memory to protect against overload and password guessing and is never written to disk. The hosting provider may keep its own request logs.',
  'This data is used only for security, protection against abuse and keeping the service stable.')}
${sec(3, 'Cookies and local storage',
  'The site uses technical cookies (sign-in with Discord or email for 30 days, and a short-lived cookie for the sign-in itself) and your browser\'s local storage, which holds a random browser ID so you can get back to your seat if the connection drops. More in the <a href="#/cookies">cookie notice</a>.',
  'There are no advertising or analytics cookies. Fonts are loaded from Google Fonts. If you turn off cookies or clear the storage, signing in and getting back into a game may stop working.')}
${sec(4, 'Why we process data',
  'Data is used to run games and lobbies, return players to their game, support sign-in with Discord and email, keep the season table, protect against spam and attacks, investigate bugs and answer messages.')}
${sec(5, 'How long we keep it',
  'A room and its game are kept while the room is open, but no longer than 6 hours without activity. A sign-in lasts 30 days or until you sign out. A profile name is kept until you reset it or ask us to delete it. An email account is kept until you ask us to delete it; once deleted, it is also removed from backups, which are kept for no more than 14 days. The season table is reset at the end of each quarter. Support emails are kept for a year.',
  'Technical logs are kept only as long as needed to look into failures and abuse.')}
${sec(6, 'Sharing data with third parties',
  'Data is never sold or passed to advertising networks.',
  'Data is processed by the hosting provider that runs the service, and only as far as needed to run it. If you sign in with Discord, Discord processes your data under its own rules. Only the site administration can see your email; it is never shown to other players. Other players in a game see your name, profile photo (your own or your Discord avatar), the revealed lines of your card and the results.')}
${sec(7, 'Your rights',
  `You can find out what data we hold about you and ask us to correct or delete it by writing to ${email()}. We will reply within 10 working days.`,
  'You can stop using the service at any time, sign out with the “Sign out” button and clear the site\'s data in your browser. Some data may be kept to the extent required by law.')}
${sec(8, 'Data protection',
  'Only the administration has access to the data, and only when technically necessary.',
  'The connection is encrypted, the sign-in cookie is signed and not available to page scripts, and the server is protected against password guessing and overload.')}
${sec(9, 'Changes to this policy',
  'We may update this document when the game or security requirements change. The current version is always on this page.')}
${contactsSec(10)}`;
    }

    function cookies() {
      return `${docHead('Cookie Notice', `Updated: ${REVISION}`)}
<p class="doc-lead">By using Detective Game, you agree that it stores a few small files in your browser. Without them the site can't remember you or bring you back into a game.</p>
<section><h2>What is stored</h2>
<ul class="doc-list">
  <li><b>Sign-in cookie.</b> Set when you sign in with Discord or email; it lasts 30 days or until you click “Sign out”.</li>
  <li><b>Sign-in session cookie.</b> Protects signing in with Discord and is deleted after 10 minutes.</li>
  <li><b>Language cookie.</b> Set if you switch the site language; it remembers your choice for a year.</li>
  <li><b>Browser storage.</b> A random ID to bring you back to your seat if the connection drops, your in-game name, your language choice and a note that you've seen this notice.</li>
</ul></section>
<section><h2>What isn't</h2>
<p>There are no advertising or analytics cookies, counters or trackers on the site. Fonts are loaded from Google Fonts.</p></section>
<section><h2>How to opt out</h2>
<p>You can turn off or delete cookies in your browser settings. Signing in and getting back into a game after a dropped connection won't work then, and your guest number will change on every visit.</p></section>
<section><h2>Questions</h2>
<p>Write to ${email()}.</p></section>`;
    }

    return { TITLES, RENDER: { rules, contacts, privacy, cookies } };
  };
})();

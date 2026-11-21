/**
 * What each project's page (`/projects/<slug>`, `routes/project`) says, in detail, written from its README: an
 * overview, its highlights, and sections such as getting started. Plain text, typographic quotes. Keyed by the slug in
 * `content/projects` (a test holds the two together); loaded only with the page.
 *
 * @module content/project-pages
 */

export interface ProjectSection {
	heading: string;
	/** Paragraphs. */
	body: string[];
	/** Bullet points after the paragraphs, if any. */
	points?: string[];
}

export interface ProjectPage {
	/** Two or three short paragraphs: what it is, who it's for, why it was built. */
	overview: string[];
	/** Four to six features, each a short title and a sentence. */
	highlights: { title: string; text: string }[];
	/** Two to four sections: getting started, how it works, under the hood. */
	sections: ProjectSection[];
}

export const projectPages: Record<string, ProjectPage> = {
	'ha-googletv': {
		overview: [
			'Raineworks TV is an unofficial Home Assistant integration for Google TV and Android TV, with a TV app of its own. One local connection does what used to take the Android TV Remote, Google Cast and ADB integrations together, and a few things none of them can.',
			'It’s for anyone running Home Assistant with a Google TV or Android TV in the house. You can control the TV, know what it’s doing, and put notifications, cameras and dashboards on screen over whatever’s on, HDMI inputs included.',
			'Everything stays on your network, except optional lookups of app icons and artwork, which one setting turns off.',
		],
		highlights: [
			{
				title: 'Control the TV',
				text: 'Power with Wake-on-LAN, volume, every app and HDMI input by its name on the TV, a remote, and what’s playing in any app with its artwork, within a second.',
			},
			{
				title: 'An Activity sensor',
				text: 'One sensor says whether the TV is off, on the home screen, in an app, playing, paused, on an HDMI input or showing the screensaver, ready to drive automations.',
			},
			{
				title: 'Notifications over anything',
				text: 'Text, an image, a doorbell clip, a live camera over WebRTC in about a second, a progress bar and buttons you answer with the remote, over apps and inputs alike.',
			},
			{
				title: 'Live notifications',
				text: 'A notification can stay up while something’s true, like the front door being open, and update in place when it’s sent again with the same tag.',
			},
			{
				title: 'A media target in place of Google Cast',
				text: 'Home Assistant’s media browser, text-to-speech and cameras play on the TV, and announcements are spoken over your show, which ducks instead of stopping.',
			},
			{
				title: 'Dashboards on the TV',
				text: 'Any Home Assistant dashboard, full screen, signed in as the TV’s own Home Assistant user, read-only unless you let it control devices.',
			},
		],
		sections: [
			{
				heading: 'Getting started',
				body: [
					'Install the integration first, then connect the TV one of two ways: through the TV app, with no developer mode, or over ADB, where Home Assistant installs the TV app itself. A TV connected through its app can be given ADB later, and its pairing stays.',
					'It needs Home Assistant 2025.2 or newer.',
				],
				points: [
					'Add the repository to HACS as a custom integration, download Raineworks TV and restart Home Assistant.',
					'Install the TV app on the TV and open it, or turn on network debugging so Home Assistant can install it over ADB.',
					'Add the TV when it appears under Settings → Devices & services → Discovered.',
					'Choose Allow on the TV when it asks to let Home Assistant connect. There’s no code to type.',
					'With the TV app alone, allow its permissions: pop-ups over other apps, notification access and app detection.',
				],
			},
			{
				heading: 'What each way gives',
				body: [
					'The TV app alone covers notifications, events, text-to-speech, media and dashboards, apps, inputs, volume, playback, now playing and the Activity sensor.',
					'ADB adds the remote’s keys, turning the TV off and back on from network standby, and which HDMI input is on screen. Over ADB, Home Assistant also keeps the TV app at the integration’s version: update the integration in HACS and the TV follows.',
				],
			},
			{
				heading: 'Events and automations',
				body: [
					'The TV app tells Home Assistant what happens on the TV as it happens: a notification’s button pressed or the notification dismissed, media played or closed, an app installed or uninstalled. Each one fires a googletv_event on Home Assistant’s event bus.',
					'That makes something like unlocking the front door from the couch a short automation: show the doorbell camera with Unlock and Ignore buttons, then wait for the Unlock press.',
				],
			},
			{
				heading: 'Privacy and security',
				body: [
					'The integration talks to the TV over ADB and to the TV app over HTTP on your network. Neither goes through Google or the internet.',
				],
				points: [
					'App names, icons and artwork are looked up online by default, with no account or key; one option keeps everything on your network.',
					'Before it installs or updates the TV app, Home Assistant checks the download against the SHA-256 published with each release.',
					'The TV app pairs when you choose Allow on the TV, and every request after that carries its token.',
					'Links to Home Assistant media sent to the TV are signed for 15 minutes as Home Assistant’s read-only content user.',
				],
			},
		],
	},
	'ha-grok': {
		overview: [
			'xAI Grok for Home Assistant is an unofficial integration that brings xAI’s Grok into Home Assistant as a conversation agent, speech to text and text to speech. It also adds an AI Task entity for automations.',
			'I built it for a fast voice assistant, so every stage streams: the transcript, the answer and the speech each start before the stage before them has finished.',
			'It uses xAI’s public API with your own API key, and xAI bills you for that usage. It has no Python dependencies beyond Home Assistant itself.',
		],
		highlights: [
			{
				title: 'Speech to text while you speak',
				text: 'Audio is streamed to xAI while you’re still speaking, so the transcript is ready almost as soon as you stop.',
			},
			{
				title: 'Answers token by token',
				text: 'Responses reach Home Assistant over server-sent events as they’re written, and tools run as soon as the model asks for them.',
			},
			{
				title: 'Speech as it’s written',
				text: 'Text is forwarded to xAI’s text to speech as it’s generated, and the audio plays as it comes back.',
			},
			{
				title: 'Prompt caching',
				text: 'A stable prompt cache key keeps the system prompt and tool list in xAI’s prompt cache between requests.',
			},
			{
				title: 'Control and search',
				text: 'Grok can use the LLM APIs you allow, such as Assist, and can look things up with web search or X search on xAI’s side.',
			},
			{
				title: 'AI Task',
				text: 'Generate data from automations, in a structure you give it and with camera snapshots attached, or generate images.',
			},
		],
		sections: [
			{
				heading: 'Getting started',
				body: [
					'It needs Home Assistant 2026.10 or newer, and an API key from console.x.ai. The key needs Voice access for speech to text and text to speech.',
				],
				points: [
					'Add the repository to HACS as a custom integration, install xAI Grok and restart Home Assistant.',
					'Add the xAI Grok integration under Settings → Devices & services and enter your API key.',
					'In Settings → Voice assistants, choose Grok as the conversation agent, with Grok Speech to text and Grok Text to speech.',
				],
			},
			{
				heading: 'How it’s fast',
				body: [
					'Each stage of a voice request streams into the next, so they overlap instead of waiting on each other.',
					'The text to speech connection is opened when the conversation turn starts, so its handshake happens while the model is thinking. The first voice request after a restart opens it on demand; later ones find it already open.',
				],
			},
			{
				heading: 'Options',
				body: [
					'Configure sets the instructions (the system prompt, with templates allowed), which Home Assistant APIs Grok may use, the model, the reasoning effort, search, the voice and the speech.',
				],
				points: [
					'The default model, grok-4.20-0309-non-reasoning, starts answering soonest; grok-4.7 is more capable but always reasons before it answers.',
					'Reasoning effort is sent to models that accept it, grok-4.5 and newer. Lower is faster.',
					'Answers that search the web or X take longer.',
					'Speech speed runs from 0.7 to 1.5, and a higher latency setting starts speaking sooner, at some cost in audio quality where chunks join.',
				],
			},
			{
				heading: 'Good to know',
				body: [
					'Home Assistant only starts speaking mid-response once the response passes 60 characters; shorter ones are spoken when the text is complete.',
				],
				points: [
					'xAI bills streaming speech to text at a higher rate than batch.',
					'Images attached in a conversation aren’t sent to the model; use the AI Task entity for those.',
					'Generating images uses grok-imagine-image-2.0, which xAI bills per image.',
				],
			},
		],
	},
	'sendspin-a1s-source': {
		overview: [
			'This is ESPHome firmware for the Ai-Thinker ESP32-A1S Audio Kit, the Everest ES8388 variant, that makes it a dedicated, encrypted Sendspin audio source. It implements Sendspin’s source@v1 audio capture specification.',
			'Plug in a turntable, a CD player, a TV’s aux output or an analog preamp, and its line-in audio streams into Music Assistant and synchronized multi-room Sendspin speaker groups.',
			'The board’s codec is set up for voice by default, so getting clean line-level audio out of it took register overrides: no automatic level control, no noise gate, and the right I²S framing.',
		],
		highlights: [
			{
				title: 'Encrypted end to end',
				text: 'A Noise_KKpsk2 handshake with Curve25519, ChaCha20-Poly1305 and SHA-256 protects every WebSocket control message and audio chunk.',
			},
			{
				title: 'Line capture, not voice',
				text: 'Codec register overrides turn off automatic level control and the voice noise gate, so quiet passages and musical decays come through.',
			},
			{
				title: 'Needle-drop autostart',
				text: 'With line sensing on, it listens while idle and tells Music Assistant when a signal starts, so a record plays to your speakers when the stylus touches down.',
			},
			{
				title: 'Steady timing',
				text: 'Capture times come from a running sample count against a single clock anchor, so scheduling jitter never reaches listeners as speed wobble.',
			},
			{
				title: 'Buffered for Wi-Fi',
				text: 'It streams uncompressed PCM by default, through a two-second PSRAM ring buffer that absorbs Wi-Fi jitter.',
			},
			{
				title: 'A stable identity',
				text: 'Its keypair is kept in non-volatile storage, so its client ID survives reboots, and its pairing token shows up once in the log and as a Home Assistant sensor.',
			},
		],
		sections: [
			{
				heading: 'Getting started',
				body: [
					'You need the ESP32-A1S Audio Kit v2.2 with the ES8388 codec. On first boot, ESPHome’s I²C scan should find a device at address 0x10; a board at 0x1A has the AC101 codec, which this driver doesn’t support.',
				],
				points: [
					'Put your Wi-Fi credentials in ESPHome’s secrets.yaml.',
					'Copy a1s-sendspin-source.yaml into your ESPHome directory. It pulls the sendspin component from this repository.',
					'Compile and flash it from the ESPHome dashboard or the esphome command line.',
					'Copy the SP:0… pairing token from the log or the Pairing Token entity, and paste it when you pair the source in Music Assistant.',
				],
			},
			{
				heading: 'Autostart and autostop',
				body: [
					'With line sensing on, the source tells Music Assistant it can sense a signal. Choose an autostart target player for it in Music Assistant’s Sendspin Source provider settings.',
					'When the needle drops, the signal goes from absent to present and Music Assistant starts playback on that player or group. When the record ends and the silence outlasts the timeout, 20 seconds by default, it stops the stream.',
				],
			},
			{
				heading: 'Under the hood',
				body: [
					'ESPHome’s ES8388 driver sets the ADC to left-justified mode while its I²S component reads Philips I²S, which inverts polarity, loses sign bits and swaps channels. The firmware overrides that register on boot.',
					'The streaming task is pinned to core 1, away from Wi-Fi and the main ESPHome loop on core 0. The board runs as a source only, since ESPHome’s I²S bus can’t run full duplex.',
				],
				points: [
					'Opus encoding is built in, but it’s off by default: on hardware it has run slower than real time and dropped audio, so the shipped config streams PCM.',
					'Don’t turn on ESPHome’s own API or OTA encryption: it strips the Noise pattern Sendspin needs and breaks its handshake. Sendspin encrypts its own traffic.',
					'Every push to master publishes a tagged release, so a build can be pinned to a version instead of tracking master.',
				],
			},
		],
	},
	'ha-everscent': {
		overview: [
			'EverScent for Home Assistant is an unofficial integration for EverScent whole-home HVAC scent diffusers. It talks to the same cloud API the EverScent mobile app uses, so you can see and control your diffuser from Home Assistant.',
			'I built it by observing the official app’s own network behavior, for personal interoperability with hardware I own. The API is undocumented, so it may change at any time.',
			'There’s no local control to use instead: the diffuser only accepts commands relayed through EverScent’s cloud, and its Bluetooth is only used to set up its Wi-Fi.',
		],
		highlights: [
			{
				title: 'Power and schedules',
				text: 'A power switch for each diffuser on your account, and a switch to turn each of its schedules on or off.',
			},
			{
				title: 'The fragrance at a glance',
				text: 'Sensors for the fragrance’s name, level and category, the current concentration, the firmware version, the Wi-Fi network and the location.',
			},
			{
				title: 'Status',
				text: 'Binary sensors for online, fragrance low, battery low, fan running, light and a firmware update being available.',
			},
			{
				title: 'Quick scent',
				text: 'A button for a quick scent burst, with its duration adjustable from 5 to 120 seconds, and one to acknowledge an empty bottle.',
			},
			{
				title: 'Schedules from automations',
				text: 'Two actions create, update and delete schedules, using a preset or your own diffusing time, pause time and concentration.',
			},
		],
		sections: [
			{
				heading: 'Getting started',
				body: [
					'If you sign in to EverScent with Google, Apple or Facebook and never set a password, use Forgot password in the EverScent app to set one first. Your social login keeps working in the app.',
				],
				points: [
					'Add the repository to HACS as a custom integration, install EverScent and restart Home Assistant.',
					'Add the EverScent integration under Settings → Devices & services.',
					'Sign in with your EverScent email and password.',
				],
			},
			{
				heading: 'How it works',
				body: [
					'It signs in with Firebase Authentication and keeps the long-lived refresh token, so you only log in once. That token is exchanged for a fresh one-hour access token automatically, and Home Assistant asks you to sign in again if it’s ever revoked.',
					'It polls EverScent’s cloud every 60 seconds by default, and sends power, quick scent and schedule changes through the same API the app uses.',
				],
				points: [
					'everscent.set_schedule creates a schedule, or updates one when given its ID, for the days and hours you choose.',
					'everscent.delete_schedule removes one. The IDs both need are attributes on the schedule switches.',
				],
			},
		],
	},
	'ha-warden': {
		overview: [
			'Out of the box, Home Assistant users are either administrators or users, and a user can see and control everything. Warden lets you put people in groups and decide, per group, which entities, devices, areas, dashboards and sidebar panels they can use.',
			'It can also require two-factor authentication, for everyone or per group, with a grace period.',
			'Home Assistant already checks every state read and entity service call against a per-user policy; it just has no way to configure one. Warden compiles each person’s groups into that policy, so the enforcement is Home Assistant’s own.',
		],
		highlights: [
			{
				title: 'Groups',
				text: 'Groups with any number of members, and a person can be in several, with their rules adding up.',
			},
			{
				title: 'Read, control or deny',
				text: 'Rules by entity, device, area, domain, label or everything, and a deny wins over everything, from any group at any scope.',
			},
			{
				title: 'Dashboards and panels',
				text: 'Pick which dashboards and sidebar pages a group can open; the rest leave the sidebar, and asking for one directly shows an access denied page.',
			},
			{
				title: 'Required two-factor authentication',
				text: 'After the grace period, anyone still without it can only reach their profile page, and their access comes back the moment they enroll.',
			},
			{
				title: 'A prompt wherever they are',
				text: 'Once 2FA is required, a dialog opens on whatever page someone has open and walks them through setting up an authenticator app.',
			},
			{
				title: 'Hard to lock yourself out',
				text: 'The owner account is never restricted, and Warden refuses a change that would take away your own admin access.',
			},
		],
		sections: [
			{
				heading: 'Rules',
				body: [
					'Rules from all of a person’s groups add up. If any grants Control they can control it, if one grants Read they can see it, and Deny wins over everything.',
					'That makes “all lights except the garage”, or “everything except the locks”, easy to express.',
				],
				points: [
					'Area rules follow Home Assistant’s own matching: an entity is in the area its device is in. Area deny rules also catch entities assigned to the area directly.',
					'Label rules become the entities they cover, and follow as you add or remove labels.',
				],
			},
			{
				heading: 'Administrators and 2FA',
				body: [
					'Home Assistant administrators keep full access: their groups’ entity, dashboard and panel rules don’t apply to them. Required 2FA does, on purpose, because admin accounts matter most; only the owner is exempt.',
					'An admin who misses the grace period can only reach their profile until they enroll, then gets admin straight back.',
				],
			},
			{
				heading: 'What it does and doesn’t protect',
				body: [
					'Warden sets the policy and Home Assistant enforces it: entity states over the websocket and REST APIs, service calls that target entities, devices or areas, history, and dashboards and panels.',
					'It can’t reach where Home Assistant doesn’t check entity permissions: services that don’t target entities, like calling a script directly, the logbook and registry listings. For anything sensitive, deny it outright.',
				],
			},
			{
				heading: 'Getting started',
				body: ['It needs Home Assistant 2026.10 or newer.'],
				points: [
					'Add the repository to HACS as a custom integration, install Warden and restart Home Assistant.',
					'Add the Warden integration under Settings → Devices & services and confirm.',
					'Open Warden in the sidebar to create groups, add members and set two-factor requirements.',
					'To remove it, delete the integration before its files, so every managed user gets their original role back.',
				],
			},
		],
	},
	raineworks: {
		overview: [
			'This is the site you’re reading: who I am, what I’m building, and the projects behind it. It’s open source under the MIT License, and you can read it in a terminal too, with ssh raineworks.com.',
			'It’s a Bun workspace. A Hono server compiles to one standalone binary with the site embedded, serving a React 19 front end built on shadcn/ui and ui-sdk.',
			'The projects on it are the repositories I tag raineworks on GitHub, with their stars, which the server asks GitHub for every ten minutes.',
		],
		highlights: [
			{
				title: 'Prerendered',
				text: 'Every page is rendered at build time and hydrated once it has painted, so it shows before any script loads.',
			},
			{
				title: 'Fast on every device',
				text: 'Lighthouse scores 100 in every category, on mobile and desktop.',
			},
			{
				title: 'Shares well',
				text: 'Each page has its own title, description, canonical link and share card, with a sitemap, a robots.txt and schema.org data.',
			},
			{
				title: 'In a terminal too',
				text: 'ssh raineworks.com is the same content as an OpenTUI app, with its own image.',
			},
			{
				title: 'One binary',
				text: 'Production is one standalone binary in a distroless image: no shell, no package manager, nothing else to copy.',
			},
			{
				title: 'Released by CI',
				text: 'A push to master that changes an image is a release, cut by GitHub Actions and deployed to production.',
			},
		],
		sections: [
			{
				heading: 'How it’s built',
				body: [
					'Each web app is its own package, a zone, bundled on its own and served by the server from one origin. The server also serves a typed API, documented as OpenAPI from the same Zod schemas that validate its requests.',
				],
				points: [
					'server: the Hono server, its API and every zone, compiled into one binary.',
					'ui: the design system, with shadcn components, the site’s blocks and prerendering.',
					'web-marketing: the site itself, and the content every page says.',
					'ssh: the site as an OpenTUI terminal UI over an SSH server.',
					'tools: the shared toolbox for zones, the frontend build, env, versions, releases and licence notices.',
				],
			},
			{
				heading: 'Releases and automation',
				body: [
					'Versions are calendar versions, the year, the month and a number. Every page shows its version in the footer, and clicking it opens What’s new.',
				],
				points: [
					'When a release goes out without a note, Claude writes the next one and opens it as a pull request.',
					'Claude reviews every pull request against the repo’s rules, and follows up until its findings are fixed.',
					'After CI passes on master, Claude fixes any doc the new commits made wrong.',
					'Every change reaches master through a pull request, with the checks, the review and an approval.',
				],
			},
			{
				heading: 'Getting started',
				body: ['You need Bun 1.4.4.'],
				points: [
					'Run bun install.',
					'Run bun run dev:init to create each package’s .env.local and the SSH dev host key.',
					'Run bun run dev to start every zone in watch mode, the server on port 3032 and the SSH app on port 2222.',
				],
			},
		],
	},
	dotfiles: {
		overview: [
			'These are my dotfiles: a shared development environment for macOS and Debian/Ubuntu, in two profiles. Desktop is a workstation with GUI apps; server is headless, command line only.',
			'One command sets a machine up, and running it again is safe: every step skips what’s already installed. When it finishes, you’re in a fresh zsh with everything loaded.',
			'Nothing in your home directory links into the repo, so your own settings never show up as edits and updates always pull cleanly.',
		],
		highlights: [
			{
				title: 'Two profiles',
				text: 'Desktop adds Zed with AI turned off, Ghostty and the JetBrainsMono Nerd Font; server keeps to the command line.',
			},
			{
				title: 'The everyday tools',
				text: 'zsh with a starship prompt, fzf, ripgrep, fd, bat, eza, zoxide, tmux, lazygit and delta, plus Node, Bun, Go, Rust and Python.',
			},
			{
				title: 'Containers',
				text: 'Docker with lazydocker, kubectl, k9s and kubectx; on macOS, Docker runs in a Colima VM instead of Docker Desktop.',
			},
			{
				title: 'Git from your GitHub account',
				text: 'It signs in with gh and sets git up from your GitHub account, with a per-machine SSH key for signing in and signing commits.',
			},
			{
				title: 'One command to update',
				text: 'dotfiles update pulls the latest shared config, re-runs the installer for the machine’s profile and reloads the shell.',
			},
			{
				title: 'Your settings win',
				text: 'Each tool loads the shared config from a file you own, and your own settings go after it.',
			},
		],
		sections: [
			{
				heading: 'Getting started',
				body: ['Run the setup script with the profile you want. With no profile, it asks.'],
				points: [
					'Run setup.sh from the repository with desktop for a workstation, or server for a headless machine.',
					'Already cloned? Run ~/.dotfiles/install.sh with the profile instead.',
					'Run dotfiles update later to pull new config and tools.',
					'Set DOTFILES_REPO before running setup.sh to install from a fork.',
				],
			},
			{
				heading: 'What it sets up',
				body: [
					'On macOS everything comes from Homebrew, and Colima runs as a Homebrew service, so Docker is there after every login. On Linux, packages come from apt, Docker Engine from get.docker.com, and the rest from each tool’s official installer or GitHub releases.',
					'Both profiles also get gh, Claude Code, herdr and NetBird, which is the GUI app on desktop and the CLI on servers. On Linux, Docker works in the new shell without logging out and back in.',
				],
			},
			{
				heading: 'Git identity',
				body: [
					'The last step signs in with gh and takes git’s name from your GitHub profile and its email from your GitHub noreply address. It creates a per-machine ed25519 key and uploads it as both an auth key and a signing key, so commits and tags show as Verified.',
					'It’s all written to your own ~/.gitconfig, never the repo, and once an identity is set, later installs and updates leave it alone.',
				],
			},
			{
				heading: 'Customizing',
				body: ['Each tool gets a file you own that loads the shared config first. Your settings go after it and win.'],
				points: [
					'zsh: ~/.zshrc sources the shared zshrc on its first line.',
					'git: ~/.gitconfig includes the shared config at the top, and git config --global writes below it.',
					'starship: a starship.toml of your own replaces the shared prompt.',
					'Ghostty: config.local loads after the shared config.',
					'Zed: the shared settings are merged in at install; yours win, but AI stays off.',
				],
			},
		],
	},
	'devcontainer-features': {
		overview: [
			'These are small, dependable Dev Container Features for Bun, Deno and Node.js. Add one to a devcontainer.json and the runtime is installed when the container is built.',
			'The Node.js feature is a smaller alternative to the official one: a checksum-verified install without nvm, with pnpm, Yarn and Bun as options.',
			'Each feature is versioned on its own, and its :1 tag follows its major version, so you get compatible updates without breaking changes.',
		],
		highlights: [
			{
				title: 'Bun',
				text: 'Installs the Bun runtime to /usr/local/bin, on the PATH for every user, at the version you pick or the latest.',
			},
			{
				title: 'Deno',
				text: 'Installs the Deno runtime the same way, to /usr/local/bin, at the version you pick or the latest.',
			},
			{
				title: 'Node.js, verified',
				text: 'Installs Node.js from the official nodejs.org tarball, checked against its published SHA-256 checksum.',
			},
			{
				title: 'Package managers',
				text: 'npm comes with Node.js, pnpm installs by default, and Yarn, modern or classic, and Bun install on request.',
			},
			{
				title: 'Tested',
				text: 'Each feature has scenario tests with pinned versions and base images, alongside the generated ones.',
			},
		],
		sections: [
			{
				heading: 'Getting started',
				body: [
					'Add one or more features to your devcontainer.json by their references. Leave the version out, or set it to latest, to get the newest release.',
					'Each one needs a Debian or Ubuntu based image; Node.js also needs x86_64 or arm64.',
				],
				points: [
					'ghcr.io/raine-works/devcontainer-features/bun:1',
					'ghcr.io/raine-works/devcontainer-features/deno:1',
					'ghcr.io/raine-works/devcontainer-features/node:1',
				],
			},
			{
				heading: 'Node.js options',
				body: ['npm itself isn’t upgraded: it’s the version bundled with the Node.js you choose.'],
				points: [
					'nodeVersion: lts by default, latest, a major such as 22, or an exact version.',
					'pnpm: latest by default, a version, or none to skip it.',
					'yarn: none by default, latest or berry for modern Yarn, classic for Yarn 1.x, or a version.',
					'bun: none by default, latest, or a version.',
				],
			},
			{
				heading: 'Releasing',
				body: [
					'A feature is released by bumping its version and merging to master. The release workflow publishes only the features whose version isn’t in GHCR yet, and opens a pull request with their regenerated docs.',
					'It uses GitHub Actions’ built-in token, so no secrets are needed.',
				],
			},
		],
	},
};

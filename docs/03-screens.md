# 03 · Screens (26)

Images: `design/screens/light/<Name>.png` and `design/screens/dark/<Name>.png`. All screens are 390 x 844 in the design; build mobile first.

Legend: **API** = REST (`/api/v1`), **WS** = STOMP destination. Every screen also needs loading, error and offline handling unless noted.

## Flow map
```
Welcome -> Sign up -> Home -> Destination -> New trip -> Invite -> Live map
Welcome -> Log in  -> Home                                   |-> Friend, ETA list, Chat, Trip menu
Welcome -> Join -> Consent -> Live map                       |-> Expiry warning, End trip
Join -> Expired                                              |-> Arrived -> Trip ended -> Home
Live map -> Offline (overlay state)
Home/Profile -> History, Settings, Alerts, Privacy
```

## A · Welcome and account
| # | Screen (file) | Route | Purpose | Elements and buttons | API / WS |
|---|---|---|---|---|---|
| A1 | Welcome (`Main`) | `/` | First impression, two entry paths | Sunrise hero with drifting clouds and gliding plane; floating glass tags (Priya 4 min, Aman 14 min); title "Get there together"; 3 feature icons; page dots. **Skip** → Home (guest explore), **Get started** → Sign up, **I have an invite link** → Join, **Log in** → Log in | none |
| A2 | Log in (`Login`) | `/login` | Return users | Back; Email, Password (eye toggle); **Forgot password?** → Forgot; **Log in** → Home; **Google**, **Phone OTP**; **Create account** → Sign up; **Join a trip as guest** → Join. Errors inline under fields. | `POST /auth/login`, `POST /auth/oauth/google` |
| A3 | Sign up (`Signup`) | `/signup` | Create account | Back; Name, Email, Password with strength meter; Terms checkbox (link to Privacy); **Create account** → Home; **Sign up with Google**; **Log in** link | `POST /auth/signup` |
| A4 | Forgot (`Forgot`) | `/forgot` | Reset by email | Back; Email; **Send reset link**; success banner "Sent! Check your inbox"; **Back to log in** | `POST /auth/forgot`, `POST /auth/reset` |

## B · Plan a trip
| # | Screen | Route | Purpose | Elements and buttons | API / WS |
|---|---|---|---|---|---|
| B1 | Home | `/home` | Maps-style starting point | Floating top bar (menu → Settings, "Where to?" → Destination, avatar → Profile); chips Cafes, Stays, Sights, Alerts; map with you dot; recenter FAB; sheet "Ready for a trip?" with **New trip**, **Join**, live trip row (→ Live map); bottom nav Explore, Trips, Alerts, You | `GET /trips?status=active` |
| B2 | Pick destination (`Destination`) | `/trip/new/destination` | Choose where | Back, search field with clear; results with icons and distance; **RECENT** list; **Choose on map**; **Skip, no destination**. Pick → New trip | Mapbox Geocoding; `GET /places/recent` |
| B3 | New trip (`NewTrip`) | `/trip/new` | Configure | Map preview with route; Trip name; destination row with **Change**; share duration segmented 1/2/4/8 h; Friends can chat switch; **Create trip and invite** → Invite | `POST /trips` |
| B4 | Invite (`Invite`) | `/trip/:id/invite` | Share the boarding pass | Boarding-pass ticket (from/to, name, code, barcode); **Share invite link** (native share); **Copy link**; **QR code**; **Open live map**; **Skip for now** | `GET /trips/:id/invite` |

## C · Join a trip (no signup)
| # | Screen | Route | Purpose | Elements and buttons | API / WS |
|---|---|---|---|---|---|
| C1 | Join | `/join/:code?` | Enter as guest | Hero; inviter card "Priya invited you to Saturday at Phoenix, 3 friends on the map"; Your name; Trip code (mono, prefilled from link); **Continue** → Consent; **Scan QR code**; back → Home | `GET /join/:code/preview` |
| C2 | Location consent (`Permission`) | `/join/:code/consent` | Informed consent | Dialog: pulsing location icon; 3 promises (only link holders see you, stops at trip end, nothing saved); **Allow while using app**, **Allow once**, **Not now**. Triggers browser geolocation prompt. | `POST /join/:code` returns guest token |
| C3 | Link expired (`Expired`) | `/join/expired` | Dead link | Gray map, red "EXPIRED" stamp; message; code ended 2 hours ago; **Start my own trip** → Sign up, **Enter a different code** → Join, **Go to home** | `GET /join/:code/preview` returns 410 |

## D · On the trip
| # | Screen | Route | Purpose | Elements and buttons | API / WS |
|---|---|---|---|---|---|
| D1 | Live map (`LiveMap`) | `/trip/:id` | The core screen | Floating bar (back, code + "Live · 3 h left", menu); arrival toast; friend dots; you dot; animated routes; destination pin; FABs: layers, recenter, fit everyone; chat FAB with unread badge; peek sheet "3 friends on the way / Next: Priya in 4 min" (tap → ETA list) | WS `/topic/trip.{id}.locations`, `.events`; `POST /trips/:id/locations` or WS `/app/trip.{id}.loc` |
| D2 | Friend details (`Friend`) | `/trip/:id/friend/:uid` | One friend | Map shifted up, friend selected; avatar, status "Moving, updated just now", ETA badge; stats distance, ETA, speed; progress bar; **Message** → Chat; **Follow**; **Directions to Priya** (deep link to maps) | `GET /trips/:id/members/:uid` |
| D3 | Who's on the way (`EtaSheet`) | `/trip/:id/eta` | ETA list | Sort button; rows Priya, Aman, You, Rohan (Arrived); **Invite more friends** → Invite | `GET /trips/:id/eta`; WS events |
| D4 | Trip chat (`Chat`) | `/trip/:id/chat` | Talk | Header with count; day separator; bubbles; typing dots; quick chips I'm here / Running late / Wait for me; input + send; menu | `GET/POST /trips/:id/messages`; WS `.chat` |
| D5 | Trip menu (`TripMenu`) | `/trip/:id/menu` | Trip actions | Sheet: **Invite friends**, **Who's on the way**, **Extend sharing time** → Expiry, **Pause my location** switch, **Settings**, **End trip for everyone** → End trip (host), **Leave trip** | `PATCH /trips/:id`, `DELETE /trips/:id/members/me` |

## E · Moments and states
| # | Screen | Route | Purpose | Elements and buttons | API / WS |
|---|---|---|---|---|---|
| E1 | Trip ending soon (`ExpiryWarning`) | modal | 10 min warning | Countdown ring; "Sharing ends in 10 min"; segmented +30 min / +1 h / +2 h; **Extend sharing**, **End now** → End trip, **Dismiss** | `POST /trips/:id/extend` |
| E2 | End trip (`EndTrip`) | modal | Confirm | Red power icon; "End this trip for everyone?"; **End trip** → Trip ended; **Keep sharing** | `POST /trips/:id/end` |
| E3 | Arrived (`Arrived`) | `/trip/:id/arrived` | Celebrate | Confetti, ARRIVED stamp, "You made it!"; stats travelled, time, friends; **Keep sharing**, **Stop sharing and finish** → Trip ended | WS event `ARRIVED` |
| E4 | Offline (`Offline`) | overlay | No connection | Grayscale map, stale dots with "2 min ago"; amber banner "No connection, showing last known spots" with **Retry**; queued-updates card with shimmer | service worker + queue |
| E5 | Trip ended (`Ended`) | `/trip/:id/ended` | Wrap up | Boarding-pass summary (from, to, 8.1 km, 19 min, 4 friends), ENDED stamp; **Back to home**, **View trip history** → History, **Plan another trip** → New trip | `GET /trips/:id/summary` |

## F · You
| # | Screen | Route | Purpose | Elements and buttons | API / WS |
|---|---|---|---|---|---|
| F1 | Profile | `/me` | Identity and shortcuts | Hero, avatar, name, "Explorer since"; stats Trips, km together, Friends; rows Trip history, Alerts (badge), Privacy and data, Settings; **Log out** | `GET /me`, `GET /me/stats` |
| F2 | Trip history (`History`) | `/me/history` | Past trips | Filter chips All / This month / With Priya; cards with map thumbnail, name, date, km, friends, Done badge → Trip ended | `GET /me/trips` |
| F3 | Settings | `/me/settings` | Preferences | MAP: Dark map, Show speed, Distance unit km/mi; TRIPS: Default sharing time, Battery saver; ACCOUNT: Notification settings, Privacy and data, Log out | `PATCH /me/settings` |
| F4 | Alerts (`Notifications`) | `/me/alerts` | Inbox | TODAY / EARLIER groups with unread dots; **Mark all read**; PUSH ALERTS switches | `GET /me/alerts`, `POST /me/push/subscribe` |
| F5 | Privacy and data (`Privacy`) | `/me/privacy` | Control | Shield banner; Share precise location, Auto-stop at trip end, Keep trip history; **Download my data**; **Terms and Privacy Policy**; **Delete my account** (confirm with password) | `GET /me/export`, `DELETE /me` |

## Global states to build once and reuse
- **Loading**: skeleton rows and the shimmer bar. **Empty**: friendly icon, one sentence, one action. **Error**: inline message plus Retry.
- **Permission denied** (location): explain, show how to enable in browser settings, offer "Continue without sharing" (see friends only).
- **Session expired**: silent refresh, otherwise route to Log in and return to the same screen.
- **Trip ended while open**: show Trip ended and close the socket.

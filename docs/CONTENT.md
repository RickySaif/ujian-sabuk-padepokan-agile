# Writing your content

Everything a player reads during the five belts comes from one JSON document: `content/company.json`. Run `npm run check` after editing it; it tells you what to fix. The final exam (Ujian Sabuk) is not in this file: its questions and answer key live only in `supabase/setup.sql`, so the browser never sees the answers.

Tip: write `{name}` anywhere in a dialogue line, card or question to insert the player's name.

## The document

```json
{
  "company":  { "name": "Acme Co.", "campus": "Acme Campus", "tagline": "…", "color": "#3A78C9" },
  "settings": { "order": "sequential" },
  "welcome":  { "from": "Dana Reyes", "role": "CEO", "lines": ["…", "…"] },
  "levels":   ["Newcomer", "Explorer", "Contributor", "Insider", "Local legend"],
  "facts":    ["Shown when someone taps the fountain."],
  "missions": [ … ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `company.name` | yes | Shown on the title screens. |
| `company.campus`, `tagline`, `color` | no | The label above the map, the line under the title, the colour of the main building. |
| `settings.order` | no | `"sequential"` (default): missions open one after another. `"free"`: all open after meeting the CEO. |
| `welcome.from`, `welcome.lines` | yes | Who greets the new hire by the main building, and what they say. |
| `welcome.role`, `welcome.look` | no | Their title, and their appearance (see "Looks" below). |
| `levels` | no | Level names, lowest first. The last one is reached when every mission is done. |
| `facts` | no | Fun facts for the fountain. |
| `missions` | yes | 1 to 11 missions, in the order they should be played. |

## A mission

```json
{
  "id": "people",
  "title": "How we work together",
  "building": "People & Culture",
  "icon": "🤝",
  "color": "#E56B8A",
  "guide": { "name": "Maya Okafor", "role": "People Partner" },
  "intro": ["What the guide says before the mission."],
  "outro": ["What they say after it."],
  "tip": "What they say when you visit again later.",
  "xp": 100,
  "badge": { "name": "Good colleague", "emoji": "🤝" },
  "steps": [ … ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Lowercase letters, numbers and dashes. Never change it once people have started: progress is stored under it. |
| `title`, `building` | yes | The mission's name, and the name of the team's building. |
| `guide.name` | yes | The colleague standing in front of the plot. `guide.role` and `guide.look` are optional. |
| `intro` | yes | One or more lines of dialogue. |
| `icon`, `color` | no | An emoji for the building's sign and the team colour (`#RRGGBB`). |
| `outro`, `tip`, `badge` | no | See above. |
| `xp` | no | Points for finishing. Default 100. |
| `steps` | yes | One or more steps, played in order. |

## The six kinds of step

**read**: a short text, with an optional link. Blank lines separate paragraphs.
```json
{ "type": "read", "title": "Our mission", "body": "First paragraph.\n\nSecond paragraph.", "link": { "label": "Read more", "url": "https://…" } }
```

**cards**: cards to turn over. Good for facts and definitions.
```json
{ "type": "cards", "title": "Our values", "cards": [ { "emoji": "🤝", "front": "Customers first", "back": "What it means in practice." } ] }
```

**quiz**: multiple-choice questions. `answer` is the position of the right option, counting from 0. `why` is shown after the right answer. Options are shuffled for each player.
```json
{ "type": "quiz", "title": "Quick check", "questions": [
  { "id": "people-1", "q": "What are our core hours?", "options": ["9 to 5", "10 to 3", "None"], "answer": 1, "why": "Core hours are 10:00 to 15:00." } ] }
```
Every question needs an `id` that is unique in the whole document. Keep ids stable: first-try results are saved under them.

**match**: pair things up. Each pair is `[left, right]`.
```json
{ "type": "match", "title": "Who do I ask?", "prompt": "Match the question to the right place.", "pairs": [ ["My laptop will not start", "IT helpdesk"], ["My payslip looks wrong", "Finance"] ] }
```

**order**: put steps in sequence. Write the items in the correct order; the game shuffles them.
```json
{ "type": "order", "title": "Claiming an expense", "prompt": "Put the steps in order.", "items": ["Keep the receipt", "Submit it", "Manager approves"] }
```

**checklist**: real things to do, ticked off by the new hire. Ticks are saved, so they can leave and come back. An item may have a `link`.
```json
{ "type": "checklist", "title": "Set these up", "items": [ { "id": "2fa", "text": "Turn on two-step sign-in", "link": "https://…" } ] }
```

Only links that start with `https://`, `http://` or `mailto:` are shown.

## Stars and the daily review

A mission gives 3 stars when at least 90% of its quiz questions were answered correctly on the first try, 2 stars for 60%, otherwise 1. A mission without a quiz gives 3.

Once a mission is finished, its quiz questions join the pool for the daily review at the café (three random questions a day, with a streak counter).

## Looks

People get a face automatically, generated from their name, so you can ignore this. To choose one yourself, add a `look`:

```json
"guide": { "name": "Maya Okafor", "look": { "skin": 3, "hs": 4, "hair": 0, "top": 4, "bottom": 2, "skirt": 0, "cap": 0, "glasses": 1 } }
```

Each number picks from a palette in `js/art.js`: `skin` 0–4, `hs` (hair style) 0–7 in the order Short, Fringe, Curly, Buzz cut, Long, Pigtails, Headscarf, Long scarf, `hair` 0–7, `top` 0–7, `bottom` 0–5. `skirt`, `cap` and `glasses` are 0 or 1.

## Writing advice

- One idea per card. If a card needs three sentences, make it two cards.
- Ask about decisions, not trivia: "A customer asks X. What do you do?" teaches more than "In which year…".
- Use a checklist for anything that must really happen (accounts, introductions, first task).
- When you change the vision, missions or pledge here, update the exam bank in `supabase/setup.sql` too.

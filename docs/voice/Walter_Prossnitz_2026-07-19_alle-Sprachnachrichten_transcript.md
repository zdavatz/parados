# Divided Loyalties — Walter's dictated rules text (2026-07-19 voice messages)

Transcribed from `Walter_Prossnitz_2026-07-19_alle-Sprachnachrichten.mp3` (5:20, English).
The voice messages are concatenated out of document order; below they are re-ordered
into the natural document flow. Timestamps refer to the mp3.

---

## Title / opening (4:23–4:37)

Divided Loyalties. Perhaps the craziest Connect Four game ever.
In order to fully understand all the necessary details, please also watch the video.

## Introduction (4:37–5:21)

Before starting to play, it is important to internalize how the six colors of the
color wheel are interrelated. Neighboring colors will be referred to as "Color Plus".
For instance, Red Plus refers to red, orange, and purple. Green Plus refers to green,
blue, and yellow.

One player is blue, the other is yellow. Divided Loyalties is played over three or
four rounds. In each round, the blue player receives four blue, three purple, two
green, two red, and one orange stone. The yellow player receives four yellow, three
orange, two green, two red, and one purple stone.

## The Dilemmas (0:50–1:31)

The dilemmas: these occur on virtually every move. Principally, they arise from the
divided loyalties of the secondary colors. For instance, whenever you place a green
tile ostensibly to create a bridge for yourself, you are simultaneously assisting
your opponent, who can use that tile to create a bridge for themselves in a
different direction — possibly even placing that bridge before yours, and in a
worst-case scenario, which happens often enough, blocking the row you were intending
to create.

Placing a Red Plus tile within your row is even more hazardous. Any row that has a
Red Plus tile on the inside is vulnerable to being cut by a red bridge in another
direction.

## (continuation, 0:00–0:47 — follows the Dilemmas)

All diagonal rows are particularly in danger, as a Red Plus diagonal row can cut
them without even having any common squares. These bridges must immediately be
defended, otherwise they will inevitably be cut.

Another way to explain this: in your supply of 12 stones, there are 9 which you can
use to create your rows, 3 which your opponent can use to create theirs, and 6 which
either of you can use to create Red Plus rows to menace each other. All of this
because a majority of the colors have divided loyalties, and each color's loyalty is
divided in a different way.

## Scoring System (1:31–2:35)

Blue and yellow bridges placed over three tiles are worth one point. Blue and yellow
bridges placed over four tiles are worth two points.

Red tiles cannot be used by either player for making their own rows, but red and
Red Plus tiles play an extremely important role, because red bridges can be placed
by either player. These are not worth any points, but when placed across blue or
yellow bridges, these become worthless — they are said to be "cut". Red bridges can
only cut other bridges on their inside tiles; the tiles on the ends of the bridge
are immune. Red bridges are not only placed over other bridges — they also have
other defensive purposes, as you will see in the video.

Red bridges cannot be placed over each other. Blue and yellow bridges cannot be
placed over each other. And blue and yellow bridges cannot be placed over red
bridges.

The second part of the scoring concerns the regions, which are the differently
shaded sections in the playing area. Players also receive a point for each region in
which they have placed at least one bridge. To receive that point, a stone which is
on the inside of the row must be in that region.

## End of Game (2:54–3:28)

When all the tiles have been placed, the game is over. Occasionally, if each player
has one or two remaining tiles and there does not seem to be a possibility for
either player to place or cut a bridge, it may be decided to end the game at that
point.

Bridge and region points are shown separately for each player, beneath the available
stones. Merely add them together to determine who has won the game.

## Placing bridges / app mechanics (3:28–4:23; starts mid-section)

…If the row is valid, the bridge is placed. A second double-click on the same stone
clears the selection.

The dots outside of the playing area indicate where you may place a stone, but only
if a row is created and a bridge placed on that turn. You place the bridge by
double-clicking, the same as always. A dot is only lit when at least one valid
bridge is possible. If by accident you place a stone there without placing a bridge,
the stone is returned to your supply.

You cannot place a bridge if that row has been completed by your opponent or was
completed on a previous turn.

One stone can be part of more than one row, if they are going in different
directions or if that tile is the start/end point for both bridges.

---

### Notes for the merge into the Google Doc

- The "Placing bridges" chunk begins mid-sentence ("If the row is valid…") — it
  continues a section whose opening (double-click the first stone, then the last
  stone of the row) is presumably already in the existing document.
- Everything matches the current game implementation (3-or-4 rounds, dot placement
  gate + refund, cut-on-inside-tiles-only, nobody-crosses-a-bridge, region scoring
  via inside stones, double-click toggle selection). No game-logic change needed.

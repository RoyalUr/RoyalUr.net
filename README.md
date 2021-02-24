# 🎲 RoyalUr.net
A website for playing the ancient Mesopotamian board game, The Royal Game of Ur!

<p align="center"><a href="https://royalur.net">
  <img src="https://royalur.net/banner.jpg" />
</a></p>

This repository holds the client code for [RoyalUr.net](https://royalur.net).
The server code for RoyalUr.net can be found in the
[RoyalUrServer repository](https://github.com/Sothatsit/RoyalUrServer).

RoyalUr.net was created based upon the ancient Sumerian board game, The Royal Game of Ur,
in the British Museum. The original board game can be dated to 2600 BC, and was discovered
in a royal tomb in the city-state of Ur in ancient Mesopotamia.  Learn more about the game
on [Wikipedia](https://en.wikipedia.org/wiki/Royal_Game_of_Ur), or watch a fun match
between Tom Scott and Irving Finkel on [YouTube](https://youtu.be/WZskjLq040I)!


### How much of the game is luck?
The answer is, **less than you might think**!

If you'd like to learn more about strategy and the role
of luck in The Royal Game of Ur, check out our efforts over in the
[RoyalUrAnalysis repository](https://github.com/Sothatsit/RoyalUrAnalysis).
In that repository we're currently undergoing efforts to use our computers
to help us better understand the strategy and luck involved The Royal Game of Ur.


### Join the community!
If you're interested in The Royal Game of Ur, we have a [Discord](https://discord.gg/Ea49VVru5N)
and a [Reddit](https://www.reddit.com/r/GameofUr/) that you might want to check out! These are
both good places to talk about the game, its strategies, and see cool board recreations that
people have made! The Discord is also a great place to find strong opponents to challenge!

<p float="left">
  <a href="https://discord.gg/Ea49VVru5N">
    <img src="https://royalur.net/res/discord.svg" height="64" valign="middle" />
  </a>
  <a href="https://www.reddit.com/r/GameofUr/">
    <img src="https://royalur.net/res/reddit.svg" height="64" valign="middle" />
  </a>
  <a href="https://royalur.net">
    <img src="https://royalur.net/favicon.png" height="64" valign="middle" />
  </a>
</p>

# 🖥️ Compilation
This project uses Babel to transpile all Javascript to a single ES5 compatible file,
as well as a Python script to generate the resource files needed for the site.

The following commands will compile the site to _./compiled_: \
`./compile.sh release` -- Full clean compilation, with minified JS. \
`./compile.sh dev` -- No minification, no cleaning of _./compiled_ folder.

**If you run into ./res file related issues during
compilation, try updating your ./res folder.**

To update the contents of your ./res folder as the resources used by RoyalUrClient
change, simply delete it and let the compilation script download it again for you.


# 🛠️ Project Architecture
A summary of the architecture of the client-side of RoyalUr.net can be found in
[ARCHITECTURE.md](docs/ARCHITECTURE.md).

### 💾 Resource Files
The image, audio, and annotation assets required by the project are not actually
stored in git, due to git's poor handling of binary files. Instead, the script
to compile the site will automatically download the resources for you from
https://royalur.net/res.zip.


# 📝 License
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

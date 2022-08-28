window.onerror = () => {};

chrome.browserAction.onClicked.addListener(() => {
  chrome.tabs.create({ url: "https://lobby.ogame.gameforge.com/" });
});

class DataHelper {
  constructor(universe) {
    this.universe = universe;
    this.names = {};
    this.loading = false;
  }

  init() {
    return new Promise(async (resolve, reject) => {
      chrome.storage.local.get("ogi-scanned-" + this.universe, (result) => {
        let json;
        try {
          json = JSON.parse(result["ogi-scanned-" + this.universe]);
        } catch (error) {
          json = {};
        }

        this.scannedPlanets = json.scannedPlanets || {};
        this.scannedPlayers = json.scannedPlayers || {};
        this.lastPlayersUpdate = this.lastPlayersUpdate || new Date(0);
        this.lastPlanetsUpdate = this.lastPlayersUpdate || new Date(0);
        resolve();
      });
    });
  }

  clearData() {
    this.scannedPlanets = {};
    this.scannedPlayers = {};
    this.lastPlayersUpdate = new Date(0);
    this.lastPlanetsUpdate = new Date(0);
    this.lastUpdate = new Date(0);
    this.saveData();
    this.update();
  }

  saveData() {
    chrome.storage.local.set({
      [`ogi-scanned-${this.universe}`]: JSON.stringify({
        scannedPlanets: this.scannedPlanets,
        scannedPlayers: this.scannedPlayers,
        lastPlayersUpdate: this.lastPlayersUpdate,
        lastPlanetsUpdate: this.lastPlanetsUpdate,
      }),
    });
  }

  update() {
    if (this.loading) return;
    if (
      isNaN(this.lastUpdate) ||
      new Date() - this.lastUpdate > 5 * 60 * 1000
    ) {
      console.log("Starting updating ogame's data");
      this.loading = true;
      let players = {};
      this._updateHighscore(players)
        .then((players) => this._updatePlayers(players))
        .then((players) => {
          this.lastUpdate = new Date();
          this.players = players;
          this.loading = false;
        })
        .catch((err) => {
          this.loading = false;
          console.log(err);
        });
    } else {
      console.log("Last ogame's data update was: " + this.lastUpdate);
    }
  }

  _fetchXML(url) {
    return fetch(url)
      .then((rep) => rep.text())
      .then((str) => new window.DOMParser().parseFromString(str, "text/xml"))
      .then((xml) => {
        return xml;
      });
  }

  _updateHighscore(players) {
    let types = ["points", "economy", "research", "military"];
    let promises = [];

    types.forEach((type, index) => {
      let p = this._fetchXML(
        `https://${this.universe}.ogame.gameforge.com/api/highscore.xml?category=1&type=` +
          index
      ).then((xml) => {
        Array.from(xml.querySelectorAll("player")).forEach((player) => {
          let playerid = player.getAttribute("id");
          if (!players[playerid]) {
            players[player.getAttribute("id")] = {
              id: player.getAttribute("id"),
              planets: [],
            };
          }
          let position = player.getAttribute("position");
          let score = player.getAttribute("score");
          if (index == 0 && Number(position) == 1) {
            this.topScore = score;
          }

          players[player.getAttribute("id")][types[index]] = {
            position: position,
            score: score,
          };
          if (index == 3) {
            players[player.getAttribute("id")][
              types[index]
            ].ships = player.getAttribute("ships");
          }
        });
      });
      promises.push(p);
    });
    return Promise.all(promises).then(() => players);
  }

  _updatePlayers(players) {
    return fetch(`https://${this.universe}.ogame.gameforge.com/api/players.xml`)
      .then((rep) => rep.text())
      .then((str) => new window.DOMParser().parseFromString(str, "text/xml"))
      .then((xml) => {
        let update = new Date(
          Number(xml.children[0].getAttribute("timestamp")) * 1000
        );
        if (update > this.lastPlayersUpdate) {
          this.lastPlayersUpdate = update;
          this.scannedPlayers = {};
        }

        Array.from(xml.querySelectorAll("player")).forEach((player, index) => {
          let id = player.getAttribute("id");
          if (players[id]) {
            players[id].name = player.getAttribute("name");
            players[id].alliance = player.getAttribute("alliance");
            players[id].status = player.getAttribute("status")
              ? player.getAttribute("status")
              : "";

            this.names[player.getAttribute("name")] = id;
          } else {
            let playerjson = {
              id: id,
              name: player.getAttribute("name"),
              alliance: player.getAttribute("alliance"),
              status: player.getAttribute("status")
                ? player.getAttribute("status")
                : "",
              planets: [],
            };
            players[id] = playerjson;
          }
        });
        return players;
      });
  }
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0) costs[j] = j;
      else {
        if (j > 0) {
          var newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function similarity(s1, s2) {
  var longer = s1;
  var shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  var longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }
  return (
    (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength)
  );
}

const url = chrome.runtime.getURL("res/expeditions.tsv");

let expeditionsMap = {};
let logbooks = {};
fetch(url)
  .then((response) => response.text())
  .then((text) => {
    let lines = text.split("\n");
    let first = lines.shift();
    for (let line of lines) {
      line.split(",");
      let splits = line.split("\t");
      for (let split of splits) {
        // Ignoring first value
        if (split == splits[0]) continue;
        if (splits[0] == "Logbook") {
          logbooks[split] = true;
        } else {
          expeditionsMap[split] = splits[0];
        }
      }
    }
  });

function getExpeditionType(message) {
  let splits = message.split("\n\n");
  logbook = splits[splits.length - 1];
  if (logbook.includes(":")) {
    splits.pop();
  }
  message = splits.join("\n\n");

  // Checking lobbook entries
  let busy = false;
  // for (let i in logbooks) {
  //   let sim = similarity(logbook, i);
  //   if (sim > 0.9) {
  //     busy = false;
  //   }
  // }
  let max = 0;
  let similar = "";
  let type = "";
  for (let i in expeditionsMap) {
    let sim = similarity(message, i);
    console.log(sim);
    if (sim > max) {
      max = sim;
      similar = message;
      type = expeditionsMap[i];
    }
  }
  console.log(max, message);
  if (max > 0.35) {
    return { type: type, busy: busy };
  } else {
    return { type: "Unknown", busy: busy };
  }
}

let universes = {};

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type == "expedition") {
    sendResponse(getExpeditionType(request.message));
    return;
  }
  try {
    let dataHelper = universes[request.universe];
    if (dataHelper) {
      dataHelper.update();
      if (request.type == "clear") {
        dataHelper.clearData();
        return sendResponse({});
      } else if (request.type == "galaxy") {
        dataHelper.scan(request.changes);
        return sendResponse({});
      } else if (request.type == "filter") {
        return sendResponse({
          players: dataHelper.filter(request.name, request.alliance),
        });
      } else if (request.type == "get") {
        return sendResponse({ player: dataHelper.getPlayer(request.id) });
      } else if (request.type == "notification") {
        chrome.notifications.create('', request.message);
        return sendResponse(request.message);
      }
    } else {
      universes[request.universe] = new DataHelper(request.universe);
      universes[request.universe].init().then(() => {
        try {
          universes[request.universe].update();
        } catch (e) {
          universes = {};
        }
      });
      sendResponse({});
    }
  } catch (e) {
    sendResponse({});
  }
});
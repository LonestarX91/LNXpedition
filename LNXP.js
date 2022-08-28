const UNIVERSE = window.location.host.split(".")[0];
let PLAYER_CLASS_EXPLORER = 3;
let PLAYER_CLASS_WARRIOR = 2;
let PLAYER_CLASS_MINER = 1;
let PLAYER_CLASS_NONE = 0;

class SmartXped {
  constructor() {
    //this.commander = player.hasCommander;
    this.rawURL = new URL(window.location.href);
    this.page =
    this.rawURL.searchParams.get("component") ||
    this.rawURL.searchParams.get("page");
    this.universe = window.location.host.replace(/\D/g, "");
    this.currentPos = "1";
  }


  init() {
    console.log('LNX INIT');
    let res = JSON.parse(localStorage.getItem("lnx-data"));
    // get data & init default values
    this.json = res || {};

    this.json.expeditions = this.json.expeditions || {};
    this.json.currentExpes = this.json.currentExpes || [];
    this.json.expeditionSums = this.json.expeditionSums || {};
    this.json.coordsHistory = this.json.coordsHistory || [];
    this.json.topScore = this.json.topScore || 0;

    this.json.options = this.json.options || {};
    this.json.options.expeditionMission =
    this.json.options.expeditionMission || 15;

    this.gameLang = document
    .querySelector('meta[name="ogame-language"]')
    .getAttribute("content");

    this.isLoading = false;
  }

  start() {
    this.updateServerSettings();
    console.log("LNX START");
  }

  createDOM(element, options, content) {
    let e = document.createElement(element);

    for (var key in options) {
      e.setAttribute(key, options[key]);
    }
    if (content || content == 0) e.innerHTML = content;

    return e;
  }

  removeNumSeparator(str) {
    return str.replace(
      new RegExp(`\\${LocalizationStrings["thousandSeperator"]}`, "g"),
      ""
    );
  }

  calcNeededShips(options) {
    options = options || {};
    // get resources
    let resources = [
      this.removeNumSeparator(
        document.querySelector("#resources_metal").textContent
      ),
      this.removeNumSeparator(
        document.querySelector("#resources_crystal").textContent
      ),
      this.removeNumSeparator(
        document.querySelector("#resources_deuterium").textContent
      ),
    ];

    resources = resources.reduce((a, b) => parseInt(a) + parseInt(b));

    if (options.resources || options.resources == 0)
    resources = options.resources;

    let type = options.fret || this.json.options.fret;
    let fret;

    if (type == 202) {
      fret = this.json.ptFret;
    } else if (type == 203) {
      fret = this.json.gtFret;
    } else if (type == 219) {
      fret = this.json.pfFret;
    } else if (type == 210) {
      fret = this.json.pbFret;
    } else if (type == 209) {
      fret = this.json.cyFret;
    }

    let total = resources / fret;
    if (options.moreFret) total *= 107 / 100;

    return Math.ceil(total);
  }

  updateServerSettings() {
    let settingsUrl = `https://s${this.universe}-${this.gameLang}.ogame.gameforge.com/api/serverData.xml`;
    return fetch(settingsUrl)
    .then((rep) => rep.text())
    .then((str) => new window.DOMParser().parseFromString(str, "text/xml"))
    .then((xml) => {
      this.json.topScore = xml.querySelector("topScore").innerHTML;
      this.MAX_GALAXY = xml.querySelector("galaxies").innerHTML;
      this.MAX_SYSTEM = xml.querySelector("systems").innerHTML;
      this.expedition();

      return true;
    });

  }

  tooltip(sender, content, autoHide, side, timer) {
    side = side || {};
    timer = timer || 500;

    let tooltip = document.querySelector(".ogl-tooltip");

    // if (this.keepTooltip) return;

    document.querySelector(".ogl-tooltip > div") &&
    document.querySelector(".ogl-tooltip > div").remove();

    let close = document.querySelector(".close-tooltip");

    if (!tooltip) {
      tooltip = document.body.appendChild(
        this.createDOM("div", { class: "ogl-tooltip" })
      );

      close = tooltip.appendChild(
        this.createDOM("a", { class: "close-tooltip" })
      );

      close.addEventListener("click", (e) => {
        e.stopPropagation();
        tooltip.classList.remove("ogl-active");
      });

      document.body.addEventListener("click", (event) => {
        if (
          !event.target.getAttribute("rel") &&
          !event.target.closest(".tooltipRel") &&
          !event.target.classList.contains("ogl-colors") &&
          !tooltip.contains(event.target)
        ) {
          tooltip.classList.remove("ogl-active");
          this.keepTooltip = false;
        }
      });
    }
    tooltip.classList.remove("ogl-update");

    if (sender != this.oldSender) {
      tooltip.classList.remove("ogl-active");
    }
    tooltip.classList.remove("ogl-autoHide");
    tooltip.classList.remove("ogl-tooltipLeft");
    tooltip.classList.remove("ogl-tooltipRight");
    tooltip.classList.remove("ogl-tooltipBottom");

    this.oldSender = sender;

    let rect = sender.getBoundingClientRect();
    let win = sender.ownerDocument.defaultView;
    let position = {
      x: rect.left + win.pageXOffset,
      y: rect.top + win.pageYOffset,
    };

    if (side.left) {
      tooltip.classList.add("ogl-tooltipLeft");
      position.y -= 20;
      position.y += rect.height / 2;
    } else if (side.right) {
      tooltip.classList.add("ogl-tooltipRight");
      position.x += rect.width;
      position.y -= 20;
      position.y += rect.height / 2;
    } else if (side.bottom) {
      tooltip.classList.add("ogl-tooltipBottom");
      position.x += rect.width / 2;
      position.y += rect.height;
    } else {
      position.x += rect.width / 2;
    }

    if (sender.classList.contains("tooltipOffsetX")) {
      position.x += 33;
    }

    if (autoHide) {
      tooltip.classList.add("ogl-autoHide");
    }

    tooltip.appendChild(content);

    tooltip.style.top = position.y + "px";
    tooltip.style.left = position.x + "px";

    this.tooltipTimer = setTimeout(
      () => tooltip.classList.add("ogl-active"),
      timer
    );

    if (!sender.classList.contains("ogl-tooltipInit")) {
      sender.classList.add("ogl-tooltipInit");
      sender.addEventListener("mouseleave", (event) => {
        if (autoHide) {
          tooltip.classList.remove("ogl-active");
        }
        clearTimeout(this.tooltipTimer);
      });
    }

    return tooltip;
  }

  expedition() {
    if (this.page == "fleetdispatch") {
      let tooltipDiv = this.createDOM("div");

      let el = document.querySelector("#allornone");
      var container = document.createElement("div");
      container.id = "lnxContainer";
      let lnxDiv = this.createDOM("div", { class: "allornonewrap" });
      lnxDiv.id = "lnxDiv";

      let shipsContainer = this.createDOM("div", { class: "shipsContainer" });

      var splitSCButton = this.createDOM("button", { class: "cargoButton", id: "SCB" }, "Split SC");
      var splitLCButton = this.createDOM("button", { class: "cargoButton", id: "LCB" }, "Split LC");
      var customFleetButton = this.createDOM("button", { class: "cargoButton", id: "CCB" }, "Use Custom");
      var repeatLastButton = this.createDOM("button", { class: "cargoButton", id: "LCB" }, "Repeat Last");

      var ogCoords = this.createDOM("div", { class: "ogl-coords", id: "lnxOGC"});

      shipsContainer.appendChild(splitSCButton);
      shipsContainer.appendChild(splitLCButton);
      shipsContainer.appendChild(customFleetButton);
      shipsContainer.appendChild(repeatLastButton);
      lnxDiv.appendChild(shipsContainer);

      var currentTarget = fleetDispatcher.targetPlanet.galaxy + ":" + fleetDispatcher.targetPlanet.system + ":16";

      var pos1Button = this.createDOM("button", {class: "posButton", id: "pos1Button", "contentEditable": false}, currentTarget);
      var pos2Button = this.createDOM("button", {class: "posButton", id: "pos2Button", "contentEditable": false}, currentTarget);
      var editPosButton = this.createDOM("button", {class: "editPosButtonOFF", id: "editPosButton"});
      var pos3Button = this.createDOM("button", {class: "posButton", id: "pos3Button", "contentEditable": false}, currentTarget);
      var pos4Button = this.createDOM("button", {class: "posButton", id: "pos4Button", "contentEditable": false}, currentTarget);

      ogCoords.appendChild(pos1Button);
      ogCoords.appendChild(pos2Button);
      ogCoords.appendChild(editPosButton);
      ogCoords.appendChild(pos3Button);
      ogCoords.appendChild(pos4Button);

      lnxDiv.appendChild(ogCoords);
      container.appendChild(lnxDiv);


      $(function(){
        $("#editPosButton").click(function(){
          $('#editPosButton').toggleClass('editPosButtonON editPosButtonOFF');
          for (var e of document.getElementsByClassName("posButton")) {
            e.style.background = $('#editPosButton').attr('class').includes("editPosButtonON") ? 'linear-gradient(to right, rgb(0, 102, 0), rgb(9, 14, 19))' : 'linear-gradient(to right, rgb(28, 43, 56) 45%, rgb(9, 14, 19))';
            e.contentEditable = $('#editPosButton').attr('class').includes("editPosButtonON");
          }
        });
      });

      [pos1Button, pos2Button, pos3Button, pos4Button].forEach((btn) => {

        btn.onmouseover = function(e) {
          console.log('MOUSE');
          if (btn.style.background != 'linear-gradient(to right, rgb(157, 18, 18) 60%, rgb(0, 0, 0))') {
            btn.style.background = 'linear-gradient(to right, rgb(0, 102, 0), rgb(9, 14, 19))';
          }
        };

        btn.onmouseout = function(e) {
          if ($('#editPosButton').attr('class').includes('editPosButtonON')) {
            if (btn.style.background != 'linear-gradient(to right, rgb(157, 18, 18) 60%, rgb(0, 0, 0))') {
              btn.style.background = 'linear-gradient(to right, rgb(0, 102, 0), rgb(9, 14, 19))';
            }
          }
          else {
            btn.style.background = 'linear-gradient(to right, rgb(28, 43, 56) 45%, rgb(9, 14, 19))';
          }
        };

        btn.addEventListener("input", function() {
          if(/^[0-9]+:[0-9]+:[0-9]+$/.test(btn.innerText)) {
            btn.style.background = 'linear-gradient(to right, rgb(0, 102, 0), rgb(9, 14, 19))';
            document.getElementById("editPosButton").disabled = false;
          }
          else {
            document.getElementById("editPosButton").disabled = true;
            btn.style.background = 'linear-gradient(to right, rgb(157, 18, 18) 60%, rgb(0, 0, 0))';
          }
        }, false);

        btn.addEventListener("click", () => {
          if (!$('#editPosButton').attr('class').includes('editPosButtonON')) {
            [pos1Button, pos2Button, pos3Button, pos4Button].forEach((btn) => {
              btn.style.background = 'linear-gradient(to right, rgb(28, 43, 56) 45%, rgb(9, 14, 19))';
            });
            btn.style.background = 'linear-gradient(to right, rgb(0, 102, 0), rgb(9, 14, 19))';
            let inputs = document.querySelectorAll(".ogl-coords input");
            inputs[0].value = btn.innerText.split(':')[0];
            inputs[1].value = btn.innerText.split(':')[1];
            inputs[2].value = 16;
            fleetDispatcher.targetPlanet.galaxy = btn.innerText.split(':')[0];
            fleetDispatcher.targetPlanet.system = btn.innerText.split(':')[1];
            fleetDispatcher.targetPlanet.position = 16;
            fleetDispatcher.holdingtime = 1;
            fleetDispatcher.targetPlanet.type = 1;
            fleetDispatcher.mission = fleetDispatcher.fleetHelper.MISSION_EXPEDITION;
            fleetDispatcher.refreshTarget();
            fleetDispatcher.updateTarget();
            fleetDispatcher.fetchTargetPlayerData();
            fleetDispatcher.refresh();
            console.log('FD UPDATE');
          }
        });
      });

      el.parentNode.insertBefore(container, el.nextSibling);
      $(".cargoButton").on("mouseover", (event) => {
        if (event.target.id == "SCB") {
          tooltipDiv.innerHTML = '<p>This option splits all your available SMALL CARGOS between the number of available expeditions and also keeping the number under the maximum possible expedition points</p>';
        } else if (event.target.id == "LCB") {
          tooltipDiv.innerHTML = '<p>This option splits all your available LARGE CARGOS between the number of available expeditions and also keeping the number under the maximum possible expedition points</p>';
        }
        else if (event.target.id == "CCB"){
          tooltipDiv.innerHTML = '<p>This option uses your custom predefined fleet in the Standard fleets settings. The fleet you wish to use should be named "Expedition". This option is available only for accounts with Commander and implicitly access to "Standard Fleets"</p>';
        }
        this.tooltip(event.target, tooltipDiv, true, { above: true });
      });

      $("#editPosButton").on("mouseover", (event) => {
        tooltipDiv.innerHTML = '<p>When locked, target coords buttons select the desired coords. When unlocked, you can edit them by clicking on their text. Use X:Y:Z format please. Save by locking.</p>';
        this.tooltip(event.target, tooltipDiv, true, { above: true });
      });

      $(".posButton").on("mouseover", (event) => {
        tooltipDiv.innerHTML = '<p>Please make sure the coords are in a valid format in order to be able to lock them.</p>';
        this.tooltip(event.target, tooltipDiv, true, { above: true });
      });

      let topScore = this.json.topScore

      // https://board.origin.ogame.gameforge.com/index.php/Thread/872-Guide-12-Expedition-guide/
      let maxTotal = 0;
      let minSC,
      minLC = 0;

      if (topScore < 10000) {
        maxTotal = 40000;
        minSC = 273;
        minLC = 91;
      } else if (topScore < 100000) {
        maxTotal = 500000;
        minSC = 423;
        minLC = 141;
      } else if (topScore < 1000000) {
        maxTotal = 1200000;
        minSC = 423;
        minLC = 191;
      } else if (topScore < 5000000) {
        maxTotal = 1800000;
        minSC = 423;
        minLC = 191;
      } else if (topScore < 25000000) {
        maxTotal = 2400000;
        minSC = 573;
        minLC = 191;
      } else if (topScore < 50000000) {
        maxTotal = 3000000;
        minSC = 723;
        minLC = 241;
      } else if (topScore < 75000000) {
        maxTotal = 3600000;
        minSC = 873;
        minLC = 291;
      } else if (topScore < 100000000) {
        maxTotal = 4200000;
        minSC = 1023;
        minLC = 341;
      } else {
        maxTotal = 5000000;
        minSC = 1223;
        minLC = 417;
      }

      maxTotal =
      this.playerClass == PLAYER_CLASS_EXPLORER
      ? maxTotal * 3 * this.json.speed
      : maxTotal * 2;

      let maxSC = Math.max(
        minSC,
        this.calcNeededShips({ fret: 202, resources: maxTotal })
      );
      let maxLC = Math.max(
        minLC,
        this.calcNeededShips({ fret: 203, resources: maxTotal })
      );

      let maxExp = fleetDispatcher.explorationCount;
      let currentExp = fleetDispatcher.expeditionCount;
      let availableExpSlots = maxExp - currentExp;
      let availableSC = 0;
      let availableLC = 0;

      fleetDispatcher.shipsOnPlanet.forEach((elem) => {
        if(elem.id == 202) {
          availableSC = elem.number > 0 ? elem.number : 0;
        }
        if(elem.id == 203) {
          availableLC = elem.number > 0 ? elem.number : 0;
        }
      });
      let currentSCSplit = Math.floor(availableSC / availableExpSlots) > 0 ? Math.floor(availableSC / availableExpSlots) : 0;
      let currentLCSplit = Math.floor(availableLC / availableExpSlots) > 0 ? Math.floor(availableLC / availableExpSlots) : 0;

      let prio = [218, 213, 211, 215, 207];
      let bigship = 0;

      prio.forEach((shipID) => {
        if (
          bigship == 0 &&
          document
          .querySelector(
            `.technology[data-technology="${shipID}"] .amount`
          )
          .getAttribute("data-value") > 0
        ) {
          bigship = shipID;
        }
      });

      $(".cargoButton").on("click", (event) => {
        document.querySelector("#resetall").click();

        let inputs = document.querySelectorAll(".ogl-coords input");
        if (inputs[2]) {
          inputs[2].value = 16;
        }
        fleetDispatcher.targetPlanet.position = 16;
        fleetDispatcher.holdingtime = 1;
        fleetDispatcher.targetPlanet.type = 1;
        fleetDispatcher.mission = fleetDispatcher.fleetHelper.MISSION_EXPEDITION;
        fleetDispatcher.refreshTarget();
        fleetDispatcher.updateTarget();
        fleetDispatcher.fetchTargetPlayerData();
        fleetDispatcher.refresh();

        if (event.target.id == 'SCB') {
          fleetDispatcher.selectShip(202, currentSCSplit);
          fleetDispatcher.selectShip(bigship, 1);
          fleetDispatcher.selectShip(210, 1);
          fleetDispatcher.selectShip(219, 1);
          fleetDispatcher.refresh();
          console.log('SMALL CARGO SPLIT');
        } else if (event.target.id == 'LCB') {
          fleetDispatcher.selectShip(202, currentSCSplit);
          fleetDispatcher.selectShip(203, currentLCSplit);
          fleetDispatcher.selectShip(bigship, 1);
          fleetDispatcher.selectShip(210, 1);
          fleetDispatcher.selectShip(219, 1);
          fleetDispatcher.refresh();
          console.log('LARGE CARGO SPLIT');
        } else if (event.target.id == 'CCB') {
          console.log('CUSTOM CARGO SPLIT');
        }
      });
    }
  }
}
try {
  (async () => {
    let lnxt = new SmartXped();
    setTimeout(function () {
      lnxt.init();
      lnxt.start();
    }, 0);
  })();
} catch (e) {
  console.log(e);
}

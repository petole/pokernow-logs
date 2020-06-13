const fs = require("fs");
const prettyBytes = require("pretty-bytes");
const csv = require("csvtojson");

const DEBUG = false;

const PREFLOP = "PREFLOP";
const FLOP = "FLOP";
const TURN = "TURN";
const RIVER = "RIVER";
const BLIND = "BLIND";

function log(string) {
  if (DEBUG === true) {
    console.log(string);
  }
}
async function main() {
  const filepath = process.argv[2];

  if (filepath === null || filepath === undefined) {
    throw Error("Need the path to pokernow csv");
  }

  //   console.log(
  //     `Read ${filepath} which contains ${prettyBytes(content.length)} bytes`
  //   );

  const jsonArray = await csv().fromFile(filepath);
  log(`Found ${jsonArray.length} events`);
  printGameSummary(jsonArray);
  findMoneyFromAdmin(jsonArray);
  // printGameStats(jsonArray);
  const hands = getHands(jsonArray);
  printPlayerStats(hands);
}

// function printGameSummary(array) {
// console.log(`~~~~~~~~~~~ Game stats ~~~~~~~~~~~~~~`);
// printGainedHands(array);

// }

function getHands(array) {
  let hand = -1;
  let tempHands = {};
  for (let i = array.length; i--; i >= 0) {
    const item = array[i];
    const entry = item.entry;
    if (entry.indexOf(`- starting hand `) > 0) {
      // in hands
      hand++;
    }
    if (tempHands[hand] === undefined) {
      tempHands[hand] = [];
    }
    if (
      entry.indexOf("The player ") === 0 ||
      entry.indexOf("The admin ") === 0
    ) {
      // we ignore
    } else if (entry.indexOf(`-- ending hand  `) === 0) {
    } else {
      tempHands[hand].push(entry);
    }
  }
  let hands = [];
  Object.values(tempHands).forEach((hand, index) => {
    let handObject = getHandObjectForHand(hand, index + 1);
    verifyHand(handObject, index + 1);
    hands.push(handObject);
  });

  return hands;
}

function getHandObjectForHand(hand, index) {
  let handObject = {
    call: 0,
    raise: 0,
    allin: 0,
    winners: [], // names of winner
    players: {},
    totalPREFLOP: 0,
    totalFLOP: 0,
    totalTURN: 0,
    totalRIVER: 0,
  };
  let STATE = BLIND; // PREFLOP || FLOP || TURN || RIVER
  log(`--------------------------------------------------------------`);
  log(`Hands ${index}. Lets' shuffle up and deal`);
  hand.forEach((line) => {
    if (line.indexOf(`Your hand is `) === 0) {
      handObject.initialHand = line.substring(13);
    } else if (line.indexOf(`flop: `) > -1) {
      STATE = FLOP;
    } else if (line.indexOf(`turn: `) > -1) {
      STATE = TURN;
    } else if (line.indexOf(`river: `) > -1) {
      STATE = RIVER;
    } else if (line.indexOf(` folds`) > 0) {
      let name = getNameForFolds(line);
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name].folded = true;
      log(`[${STATE.padEnd(6, " ")}] ${name} folds`);
    } else if (line.indexOf(`posts a small blind of `) > 0) {
      let name = getNameForBlind(line);
      let amount = getAmoutForBlind(line);
      handObject.smallBlindName = name;
      handObject.smallBlindValue = amount;
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name][STATE] = amount;
      // handObject.players[name]
      //   ? (handObject.players[name] += amount)
      //   : (handObject.players[name] = amount);
      handObject[`total${STATE}`] += amount;
      log(`[${STATE.padEnd(6, " ")}] ${name} posted small blind ${amount}`);
    } else if (line.indexOf(`posts a missing small blind of `) > 0) {
      let name = getNameForBlind(line);
      let amount = getAmoutForBlind(line);
      handObject.missingSmallBlindName = name;
      handObject.missingSmallBlindValue = amount;
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name][STATE] = amount;
      handObject[`total${STATE}`] += amount;
      log(
        `[${STATE.padEnd(6, " ")}] ${name} posted big (missed) blind ${amount}`
      );
    } else if (line.indexOf(`posts a big blind of `) > 0) {
      let name = getNameForBlind(line);
      let amount = getAmoutForBlind(line);
      handObject.bigBlindName = name;
      handObject.bigBlindValue = amount;
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name][STATE] = amount;
      log(`[${STATE.padEnd(6, " ")}] ${name} posted big blind ${amount}`);
      handObject[`total${STATE}`] += amount;
      STATE = PREFLOP;
    } else if (line.indexOf(` calls with `) > 0) {
      let name = getNameForCallRaise(line);
      let amount = getAmoutCallRaise(line);
      handObject.call = handObject.call + 1;
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name][STATE] = amount;
      handObject[`total${STATE}`] += amount;
      debugger;
      log(
        `[${STATE.padEnd(
          6,
          " "
        )}] ${name} calls ${amount} : # calls on this hand: ${
        handObject.call
        }, total amount: ${getAmountForHand(handObject)}`
      );
    } else if (line.indexOf(` raises with `) > 0) {
      let name = getNameForCallRaise(line);
      let amount = getAmoutCallRaise(line);
      handObject.raise = handObject.raise + 1;
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name][STATE] = amount;
      handObject[`total${STATE}`] += amount;
      log(
        `[${STATE.padEnd(
          6,
          " "
        )}] ${name} raises ${amount} : # raises on this hand: ${
        handObject.raise
        }, total amount: ${getAmountForHand(handObject)}`
      );
    } else if (line.indexOf(` raises and all in with `) > 0) {
      let name = getNameForAllin(line);
      let amount = getAmoutForAllin(line);
      handObject.raise = handObject.raise + 1;
      handObject.allin = handObject.allin + 1;
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name][STATE] = amount;
      handObject[`total${STATE}`] += amount;
      log(
        `[${STATE.padEnd(
          6,
          " "
        )}] ${name} raises all in ${amount} : #all in on this hand: ${
        handObject.allin
        }, total amount: ${getAmountForHand(handObject)}`
      );
    } else if (line.indexOf(` calls and all in with `) > 0) {
      let name = getNameForAllin(line);
      let amount = getAmoutForAllin(line);
      handObject.call = handObject.call + 1;
      handObject.allin = handObject.allin + 1;
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name][STATE] = amount;
      handObject[`total${STATE}`] += amount;
      log(
        `[${STATE.padEnd(
          6,
          " "
        )}] ${name} calls and all in ${amount} : #all in on this hand: ${
        handObject.allin
        }, total amount: ${getAmountForHand(handObject)}`
      );
    } else if (line.indexOf(` gained `) > 0) {
      let name = getNameForGained(line);
      let gainedAmount = getAmoutForGained(line); // this is not correct according to my observation
      // bug: does not work with split winners
      //      console.log(`DEBUG: amount: ${handObject.totalAmount}  and invested by ${name}: ${handObject.players[name]}`)
      // if (gainedAmount !== handObject.winnerGain) {
      //   console.error(`ERROR mismatch between gained amount ${gainedAmount} and winnerGained ${handObject.winnerGain}: ${handObject.totalAmount} || ${name} || ${handObject.players[name]}`)
      //   console.error(JSON.stringify(handObject));
      //       }
      handObject.winners.push({
        name,
        gain:
          getAmountForHand(handObject) -
          getAmountForHandAndPlayer(handObject.players[name]),
      });
      log(
        `[${STATE.padEnd(6, " ")}] ${name} gained ${
        getAmountForHand(handObject) -
        getAmountForHandAndPlayer(handObject.players[name])
        }, for a total pot of ${getAmountForHand(handObject)}`
      );
    } else if (line.indexOf(` shows a `) > 0) {
      let name = getNameForShows(line);
      let cards = getCardsForShows(line);
      if (!handObject.players[name]) {
        handObject.players[name] = {
          folded: false,
          BLIND: 0,
          PREFLOP: 0,
          FLOP: 0,
          TURN: 0,
          RIVER: 0,
        };
      }
      handObject.players[name]['cards'] = cards;
    } else if (line.indexOf(` wins `) > 0) {
      let name = getNameForWin(line);
      let winAmount = getAmoutForWin(line);
      let cards = getCardsForWin(line);
      checkForAllinAdjustments(handObject);
      handObject.winners.push({
        name,
        gain: winAmount - getAmountForHandAndPlayer(handObject.players[name]),
      });
      handObject.players[name].paid = true;
      handObject.players[name]['cards'] = cards;
      log(
        `[${STATE.padEnd(6, " ")}] ${name} wins ${winAmount} so, a gain of ${
        winAmount - getAmountForHandAndPlayer(handObject.players[name])
        } , for a total pot of ${getAmountForHand(handObject)}`
      );
    }
  });
  return handObject;
}

function checkForAllinAdjustments(hand) {
  const players = Object.keys(hand.players);
  let nameBet = {};
  let bets = [];
  let sortedNameBet = []; // [ {name: player1, bet: 100}, {name: player2, bet: 50}]
  players.forEach((playerName) => {
    if (hand.players[playerName].folded === false && hand.players[playerName].paid !== true) {
      let bet = getAmountForHandAndPlayer(hand.players[playerName]);
      bets.push(bet);
      nameBet[playerName] = bet;
      sortedNameBet.push({ name: playerName, bet: bet });
    }
  });
  sortedNameBet.sort(function compareNumbers(a, b) {
    return b.bet - a.bet;
  })
  if (!bets.every(bet => bet === bets[0])) {
    if (bets.length === 2) {
      const playerNames = Object.keys(nameBet);
      if (nameBet[playerNames[0]] > nameBet[playerNames[1]]) {
        hand.players[playerNames[0]][FLOP] -= nameBet[playerNames[0]] - nameBet[playerNames[1]]
        log(`⚠️ removed ${nameBet[playerNames[0]] - nameBet[playerNames[1]]} from ${playerNames[0]} spent money`)
      } else {
        hand.players[playerNames[1]][FLOP] -= nameBet[playerNames[1]] - nameBet[playerNames[0]]
        log(`⚠️ removed ${nameBet[playerNames[1]] - nameBet[playerNames[0]]} from ${playerNames[1]} spent money`)
      }
    } else {
      // let's find the biggest pot contributors and remove the difference with guy #2
      let difference = sortedNameBet[0].bet - sortedNameBet[1].bet;
      hand.players[sortedNameBet[0].name][FLOP] -= difference;
      //      log(`📛📛📛: 2+ people bet more than others: ${JSON.stringify(nameBet)}`)
      log(`⚠️ removed ${difference} from ${sortedNameBet[0].name} spent money`)
    }
  }
}
function getAmountForHand(hand) {
  const players = Object.keys(hand.players);
  let total = 0;
  players.forEach((playerName) => {
    total += getAmountForHandAndPlayer(hand.players[playerName]);
  });
  return total;
}

function getAmountForHandAndPlayer(player) {
  let amount = 0;
  amount += player[BLIND];
  amount += player[PREFLOP];
  amount += player[FLOP];
  amount += player[TURN];
  amount += player[RIVER];
  return amount;
}

function printPlayerStats(hands) {
  let stats = {};
  let totalWinings = 0;
  hands.forEach((hand) => {
    let winnerNames = {};
    hand.winners.forEach((winner) => {
      winnerNames[winner.name] = true;
      if (!stats[winner.name]) {
        stats[winner.name] = { winingHands: 0, gain: 0, loss: 0, cards: [] };
      }
      stats[winner.name].winingHands++;
      stats[winner.name].gain += winner.gain;
      totalWinings += winner.gain;
    });
    const players = Object.keys(hand.players);
    players.forEach((playerName) => {
      if (!stats[playerName]) {
        stats[playerName] = { winingHands: 0, gain: 0, loss: 0, cards: [] };
      }
      if (hand.players[playerName]['cards']) {

        stats[playerName]['cards'].push(hand.players[playerName]['cards']);
      }
      if (winnerNames[playerName]) {
        // we skip
      } else {
        stats[playerName].loss += getAmountForHandAndPlayer(
          hand.players[playerName]
        );
      }
    });
  });
  console.log(`+++++++++++++++ $$$$$$$ +++++++++++++++`);
  console.log(`Total money won: ${totalWinings}`);
  const players = Object.keys(stats);
  let totalGain = 0;
  let totalLoss = 0;
  players.forEach((player) => {
    totalGain += stats[player].gain;
    totalLoss += stats[player].loss;
    const euros = Math.round((stats[player].gain - stats[player].loss) / 100);
    console.log(
      `${player.padEnd(12, " ")}: ${(euros + "").padStart(
        5,
        " "
      )}EUR (gained: ${stats[player].gain}, lost: ${stats[player].loss} won ${
      stats[player].winingHands
      } hands)`
    );
  });
  console.log(`Verification: Gain - loss: ${totalGain - totalLoss}`);
  players.forEach((player) => {
    let cardsString = '';
    stats[player]['cards'].forEach(card => {
      card = card.replace(' ', '');
      card = `(${card})`;
      cardsString += `${card},`;
    })
    console.log(`${player.padEnd(12, " ")} hands: ${cardsString}`)

  });
}

function getNameForFolds(entry) {
  const regexp1 = /\"(.*)\" folds/;
  const result1 = entry.match(regexp1);
  let nameFolds = null;
  if (result1 && result1.length > 1) {
    nameFolds = result1[1];
    nameFolds = nameFolds.substring(0, nameFolds.indexOf("@") - 1);
  }
  return nameFolds;
}

function getNameForWin(entry) {
  const regexp1 = /\"(.*)\" wins /;
  const result1 = entry.match(regexp1);
  let nameGained = null;
  if (result1 && result1.length > 1) {
    nameGained = result1[1];
    nameGained = nameGained.substring(0, nameGained.indexOf("@") - 1);
  }
  return nameGained;
}

function verifyHand(hand, index) {
  let winnerNames = {};
  let stats = {};
  hand.winners.forEach((winner) => {
    winnerNames[winner.name] = true;
    if (!stats[winner.name]) {
      stats[winner.name] = { winingHands: 0, gain: 0, loss: 0 };
    }
    stats[winner.name].winingHands++;
    stats[winner.name].gain += winner.gain;
  });
  const players = Object.keys(hand.players);
  players.forEach((playerName) => {
    if (winnerNames[playerName]) {
      // we skip
    } else {
      if (!stats[playerName]) {
        stats[playerName] = { winingHands: 0, gain: 0, loss: 0 };
      }

      stats[playerName].loss += getAmountForHandAndPlayer(
        hand.players[playerName]
      );
    }
  });

  let totalGain = 0;
  let totalLoss = 0;
  players.forEach((player) => {
    totalGain += stats[player].gain;
    totalLoss += stats[player].loss;
  });
  if (totalLoss === totalGain) {
    log(`✅ all good for hand #${index}`);
  } else {
    log(`❌ problem for hand #${index}: ${totalGain - totalLoss}`);
    players.forEach((player) => {
      const euros = Math.round((stats[player].gain - stats[player].loss) / 100);
      log(
        `${player.padEnd(12, " ")}: ${(euros + "").padStart(
          5,
          " "
        )}EUR (gained: ${stats[player].gain}, lost: ${stats[player].loss} won ${
        stats[player].winingHands
        } hands)`
      );
    });
  }
}

function getNameForGained(entry) {
  const regexp1 = /\"(.*)\" gained /;
  const result1 = entry.match(regexp1);
  let nameGained = null;
  if (result1 && result1.length > 1) {
    nameGained = result1[1];
    nameGained = nameGained.substring(0, nameGained.indexOf("@") - 1);
  }
  return nameGained;
}

function getNameForAllin(entry) {
  const regexp1 = /\"(.*)\" (calls|raises) and all in with /;
  const result1 = entry.match(regexp1);
  let nameForAllin = null;
  if (result1 && result1.length > 1) {
    nameForAllin = result1[1];
    nameForAllin = nameForAllin.substring(0, nameForAllin.indexOf("@") - 1);
  }
  return nameForAllin;
}

function getNameForCallRaise(entry) {
  const regexp1 = /\"(.*)\" (calls|raises) with /;
  const result1 = entry.match(regexp1);
  let nameForCallRaise = null;
  if (result1 && result1.length > 1) {
    nameForCallRaise = result1[1];
    nameForCallRaise = nameForCallRaise.substring(
      0,
      nameForCallRaise.indexOf("@") - 1
    );
  }
  return nameForCallRaise;
}

function getNameForBlind(entry) {
  const regexp1 = /\"(.*)\" posts/;
  const result1 = entry.match(regexp1);
  let nameForBlind = null;
  if (result1 && result1.length > 1) {
    nameForBlind = result1[1];
    nameForBlind = nameForBlind.substring(0, nameForBlind.indexOf("@") - 1);
  }
  return nameForBlind;
}
function getAmoutCallRaise(entry) {
  const regexp1 = / (calls|raises) with (\d*)/;
  const result1 = entry.match(regexp1);
  let callRaiseValue = null;
  if (result1 && result1.length > 2) {
    callRaiseValue = result1[2];
    callRaiseValue = parseInt(callRaiseValue);
  }
  return callRaiseValue;
}

function getAmoutForGained(entry) {
  const regexp1 = / gained (\d*)/;
  const result1 = entry.match(regexp1);
  let gainedValue = null;
  if (result1 && result1.length > 1) {
    gainedValue = result1[1];
    gainedValue = parseInt(gainedValue);
  }
  return gainedValue;
}

function getNameForShows(entry) {
  const regexp1 = /\"(.*)\" shows a/;
  const result1 = entry.match(regexp1);
  let name = null;
  if (result1 && result1.length > 1) {
    name = result1[1];
    name = name.substring(0, name.indexOf("@") - 1);

  }
  return name;

}


//  " shows a 10♠, 3♦."
function getCardsForShows(entry) {
  const regexp1 = / shows a (.*)\./;
  const result1 = entry.match(regexp1);
  let cards = null;
  if (result1 && result1.length > 1) {
    cards = result1[1];
  }
  return cards;

}

//  wins 7616 with Flush, Jd High (hand: 10♣, J♦)
function getCardsForWin(entry) {
  const regexp1 = / wins .* \(hand: (.*)\)/;
  const result1 = entry.match(regexp1);
  let cards = null;
  if (result1 && result1.length > 1) {
    cards = result1[1];
  }
  return cards;

}
function getAmoutForWin(entry) {
  const regexp1 = / wins (\d*)/;
  const result1 = entry.match(regexp1);
  let gainedValue = null;
  if (result1 && result1.length > 1) {
    gainedValue = result1[1];
    gainedValue = parseInt(gainedValue);
  }
  return gainedValue;
}

function getAmoutForAllin(entry) {
  const regexp1 = / (calls|raises) and all in with (\d*)/;
  const result1 = entry.match(regexp1);
  let allinValue = null;
  if (result1 && result1.length > 2) {
    allinValue = result1[2];
    allinValue = parseInt(allinValue);
  }
  return allinValue;
}

function getAmoutForBlind(entry) {
  const regexp1 = / blind of (\d*)/;
  const result1 = entry.match(regexp1);
  let blindValue = null;
  if (result1 && result1.length > 1) {
    blindValue = result1[1];
    blindValue = parseInt(blindValue);
  }
  return blindValue;
}

function printGameSummary(array) {
  let handsDealt = 0;
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    const entry = item.entry;
    if (entry.indexOf("- ending hand") > 0) {
      handsDealt = getHandNumberFromEntry(entry);
      break;
    }
  }
  const admin = findAdmin(array);
  console.log(
    `Tonight, the admin of the game was ${admin}. ${handsDealt} hands were dealt`
  );
  const players = findListOfPLayers(array);
  console.log(
    `There were a total of ${
    players.length
    } players on the table: ${players.join(", ")}`
  );
}

function findListOfPLayers(array) {
  let names = {};
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    const entry = item.entry;
    const name = getNameFromEntry(entry);
    if (name) {
      names[name] = true;
    }
  }
  return Object.keys(names);
}

function getHandNumberFromEntry(entry) {
  const regexp1 = /-- ending hand #(\d*) --/;
  const result1 = entry.match(regexp1);
  let handNumber = null;
  if (result1 && result1.length > 1) {
    handNumber = result1[1];
    handNumber = parseInt(handNumber);
  }
  return handNumber;
}

function getMoneyFromEntry(entry) {
  const regexp1 = / with a stack of (\d*)\./;
  const result1 = entry.match(regexp1);
  let money = null;
  if (result1 && result1.length > 1) {
    money = result1[1];
    money = parseInt(money);
  }
  return money;
}

function getNameFromEntry(entry) {
  const regexp = /he player \"(.*)\"/;
  const result = entry.match(regexp);
  let name = undefined;
  if (result && result.length > 0) {
    const fullname = result[1];
    name = fullname.substring(0, fullname.indexOf("@") - 1);
  }
  return name;
}

function findAdmin(array) {
  for (let i = array.length; i--; i >= 0) {
    const item = array[i];
    const entry = item.entry;
    if (entry.indexOf(" created the game with a stack of ") > 0) {
      return getNameFromEntry(entry);
    }
  }
}

function findMoneyFromAdmin(array) {
  let moneySummary = {};
  for (let i = array.length; i--; i >= 0) {
    const item = array[i];
    const entry = item.entry;
    if (
      entry.indexOf(" participation with a stack of ") > 0 ||
      entry.indexOf(" created the game with a stack ") > 0
    ) {
      const name = getNameFromEntry(entry);
      const money = getMoneyFromEntry(entry);
      //      console.log(`+ ${name} puts ${money} on the table`);
      if (moneySummary[name] !== undefined) {
        moneySummary[name] = moneySummary[name] + money;
      } else {
        moneySummary[name] = money;
      }
    } else if (entry.indexOf(" quits the game with a stack ") > 0) {
      const name = getNameFromEntry(entry);
      const money = getMoneyFromEntry(entry);
      //      console.log(`- ${name} left with ${money} on the table`);
      if (moneySummary[name] !== undefined) {
        moneySummary[name] = moneySummary[name] - money;
      } else {
        moneySummary[name] = -money;
      }
    }
  }
  console.log(`============== Money Summary ===============`);
  const names = Object.keys(moneySummary);
  let totalAmountOfMoney = 0;
  names.forEach((name) => {
    console.log(`${name} put a total of ${moneySummary[name]} on the table`);
    totalAmountOfMoney += moneySummary[name];
  });
  console.log(`Total on the table: ${totalAmountOfMoney}`);
}

main();
// const content = fs.readFileSync(filepath);
// const json = parse(content)

// function parse(content) {

// }

/* global TrelloPowerUp, moment, _ */

var Promise = TrelloPowerUp.Promise;

var fetchCurrentBoardLabels = function(t, Trello, token) {
  return t.board("all").then(function(board) {
    var boardReq = {
      path: `boards/${board.id}/labels`,
      params: {
        limit: 100,
        fields: "name,color",
        token: token
      }
    };

    console.log("[MarkAsDone] [fetchBoardLabels] [request]", boardReq);
    return Trello.get(boardReq.path, boardReq.params).then(function(response) {
      console.log("[MarkAsDone] [fetchBoardLabels] [response]", response);
      return response;
    });
  });
};

var associateIdsWithLabels = function(labels, filterIdsByNameColor) {
  return labels.reduce(function(result, label) {
    var nameColorKey = `${label.name}|${label.color}`;
    var labelId = filterIdsByNameColor[nameColorKey];
    return result.concat({ id: labelId, name: label.name, color: label.color });
  }, []);
};

var groupFilterIdByNameColor = function(labels) {
  return labels.reduce(function(result, label) {
    var nameColorKey = `${label.name}|${label.color}`;
    result[nameColorKey] = label.id;
    return result;
  }, {});
};

var getCardLabelsWithIdFromBoard = function(card, boardLabels) {
  var filterIdByNameColor = groupFilterIdByNameColor(boardLabels);
  var cardLabels = associateIdsWithLabels(card.labels, filterIdByNameColor);
  return cardLabels;
};

var addAndRemoveLabelIds = function(
  initialLabels,
  removeWithNames,
  addWithNames,
  allLabels
) {
  var initialLabelIdsWithoutRemoved = initialLabels
    .filter(function(label) {
      return removeWithNames.indexOf(label.name) === -1;
    })
    .map(function(label) {
      return label.id;
    });

  var labelIdsToAdd = allLabels
    .filter(function(label) {
      return addWithNames.indexOf(label.name) >= 0;
    })
    .map(function(label) {
      return label.id;
    });

  return _.union(initialLabelIdsWithoutRemoved, labelIdsToAdd);
};

TrelloPowerUp.initialize({
  "card-buttons": function(t, options) {
    // check that viewing member has write permissions on this board
    if (options.context.permissions.board !== "write") {
      return [];
    }

    return t.get("member", "private", "token").then(function(token) {
      return [
        {
          icon:
            "https://cdn.glitch.com/a0166d9a-7b85-4089-b850-908b4169e3fd%2Fseal-of-approval.png?1514407977008",
          text: "Mark As Done",
          callback: function(context) {
            if (!token) {
              context.popup({
                title: "Authorize Your Account",
                url: "./auth.html",
                height: 75
              });
            } else {
              var pBoardLabels = fetchCurrentBoardLabels(
                t,
                window.Trello,
                token
              );
              var pCard = t.card("all");

              var pCardLabels = Promise.join(pBoardLabels, pCard, function(
                boardLabels,
                card
              ) {
                return getCardLabelsWithIdFromBoard(card, boardLabels);
              });

              var pFinalCardLabelIds = Promise.join(
                pCard,
                pCardLabels,
                pBoardLabels,
                function(card, cardLabels, boardLabels) {
                  var finalLabelIds = addAndRemoveLabelIds(
                    cardLabels,
                    ["InProgress", "In Progress"],
                    ["Merged", "Done"],
                    boardLabels
                  );
                  return finalLabelIds;
                }
              );

              Promise.join(pCard, pFinalCardLabelIds, function(
                card,
                cardLabelIds
              ) {
                var req = {
                  path: `cards/${card.id}`,
                  params: {
                    due: card.due || moment().format(),
                    dueComplete: true,
                    idLabels: cardLabelIds,
                    token: token
                  }
                };
                console.log(
                  "[MarkAsDone] [TrelloRequest]",
                  req.path,
                  req.params
                );

                window.Trello.put(req.path, req.params)
                  .then(function(response) {
                    console.log(
                      "[MarkAsDone] [TrelloResponse] [success]",
                      response
                    );
                    t
                      .set("card", "shared", { markedAsDone: true })
                      .then(function() {
                        t.closePopup();
                      });
                  })
                  .done();
              });
            }
          }
        }
      ];
    });
  }
});

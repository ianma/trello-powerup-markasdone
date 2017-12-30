/* global TrelloPowerUp, moment */

var t = TrelloPowerUp.iframe();

$("#save-btn").click(function() {
  t.card("id").then(function(card) {
    var req = {
      path: `cards/${card.id}`,
      params: {
        due: moment().format(),
        dueComplete: true
      }
    };
    console.log("[MarkAsDone]", "[TrelloRequest]", req.path, req.params);

    window.Trello.put(req.path, req.params, req.success, req.error)
      .then(function(response) {
        console.log("[MarkAsDone]", "[TrelloResponse]", "[success]", response);
        t.set("card", "shared", { markedAsDone: true }).then(function() {
          t.closePopup();
        });
      })
      .done();
  });
});

(function () {
  var _origErr = console.error;
  console.error = function () {
    var msg = Array.prototype.join.call(arguments, " ");
    if (msg.indexOf("supabase.co/auth") !== -1 && msg.indexOf("400") !== -1) return;
    _origErr.apply(console, arguments);
  };
})();

(function () {
  var _origErr = console.error;
  console.error = function () {
    try {
      var stack = new Error().stack || "";
      if (stack.indexOf("supabase") !== -1) {
        var msg = Array.prototype.join.call(arguments, " ");
        if (msg.indexOf("400") !== -1 || msg.toLowerCase().indexOf("auth") !== -1) return;
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          if (a && typeof a === "object" && (a.status === 400 || (a.url && String(a.url).indexOf("auth") !== -1))) return;
        }
      }
    } catch (_) {}
    _origErr.apply(console, arguments);
  };
})();

// Generated by CoffeeScript 1.7.1
(function() {
  this.CheckoutMode = (function() {
    function CheckoutMode(switcher, config) {
      this.switcher = switcher;
      this.cfg = config ? config : CheckoutConfig;
    }

    CheckoutMode.prototype.title = function() {
      return "[unknown mode]";
    };

    CheckoutMode.prototype.subtitle = function() {
      return null;
    };

    CheckoutMode.prototype.columns = function() {
      return [];
    };

    CheckoutMode.prototype.enter = function() {
      return this.clearReceipt();
    };

    CheckoutMode.prototype.exit = function() {};

    CheckoutMode.prototype.actions = function() {
      return [["", function() {}]];
    };

    CheckoutMode.prototype.clearReceipt = function() {
      this.cfg.uiRef.receiptTable.empty().append($("<thead>").append($("<tr>").append(this.columns())), this.cfg.uiRef.receiptResult.empty());
      return this.cfg.uiRef.receiptSum.empty();
    };

    return CheckoutMode;

  })();

}).call(this);

// Generated by CoffeeScript 1.7.1
(function() {
  var ReceiptData,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  this.CounterMode = (function(_super) {
    __extends(CounterMode, _super);

    ModeSwitcher.registerEntryPoint("customer_checkout", CounterMode);

    function CounterMode() {
      var args, modeArgs, _i;
      args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), modeArgs = arguments[_i++];
      this.onLogout = __bind(this.onLogout, this);
      this.onAbortReceipt = __bind(this.onAbortReceipt, this);
      this.onPayReceipt = __bind(this.onPayReceipt, this);
      this.onRemoveItem = __bind(this.onRemoveItem, this);
      this.showError = __bind(this.showError, this);
      this.onAddItem = __bind(this.onAddItem, this);
      CounterMode.__super__.constructor.apply(this, args);
      this._receipt = new ReceiptData();
      this.receiptSum = new ReceiptSum();
      if (modeArgs != null) {
        this.restoreReceipt(modeArgs);
      }
      this.receipt.body.attr("id", "counter_receipt");
    }

    CounterMode.prototype.glyph = function() {
      return "euro";
    };

    CounterMode.prototype.title = function() {
      return "Checkout";
    };

    CounterMode.prototype.actions = function() {
      return [[this.cfg.settings.abortPrefix, this.onAbortReceipt], [this.cfg.settings.logoutPrefix, this.onLogout], [this.cfg.settings.payPrefix, this.onPayReceipt], [this.cfg.settings.removeItemPrefix, this.onRemoveItem], ["", this.onAddItem]];
    };

    CounterMode.prototype.enter = function() {
      this.cfg.uiRef.body.append(this.receiptSum.render());
      CounterMode.__super__.enter.apply(this, arguments);
      return this._setSum();
    };

    CounterMode.prototype.addRow = function(code, item, price, rounded) {
      var index, row;
      if (rounded == null) {
        rounded = false;
      }
      if (code != null) {
        this._receipt.rowCount++;
        index = this._receipt.rowCount;
        if ((price != null) && price < 0) {
          index = -index;
        }
      } else {
        code = "";
        index = "";
      }
      row = this.createRow(index, code, item, price, rounded);
      this.receipt.body.prepend(row);
      if (this._receipt.isActive()) {
        this._setSum(this._receipt.total);
      }
      return row;
    };

    CounterMode.prototype.onAddItem = function(code) {
      if (code.trim() === "") {
        return;
      }
      if (!this._receipt.isActive()) {
        return Api.item_find({
          code: code,
          available: true
        }).then((function(_this) {
          return function() {
            return _this.startReceipt(code);
          };
        })(this), (function(_this) {
          return function(jqXHR) {
            return _this.showError(jqXHR.status, jqXHR.responseText, code);
          };
        })(this));
      } else {
        return this.reserveItem(code);
      }
    };

    CounterMode.prototype.showError = function(status, text, code) {
      var errorMsg;
      switch (status) {
        case 404:
          errorMsg = "Item is not registered.";
          break;
        case 409:
          errorMsg = text;
          break;
        case 423:
          errorMsg = text;
          break;
        default:
          errorMsg = "Error " + status + ".";
      }
      return alert(errorMsg + ' ' + code);
    };

    CounterMode.prototype.restoreReceipt = function(receipt) {
      this.switcher.setMenuEnabled(false);
      return Api.receipt_activate({
        id: receipt.id
      }).then((function(_this) {
        return function(data) {
          var item, price, _i, _len, _ref;
          _this._receipt.start(data);
          _this._receipt.total = data.total;
          _this.receipt.body.empty();
          _ref = data.items;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            item = _ref[_i];
            price = item.action === "DEL" ? -item.price : item.price;
            _this.addRow(item.code, item.name, price);
          }
          return _this._setSum(_this._receipt.total);
        };
      })(this), (function(_this) {
        return function() {
          alert("Could not restore receipt!");
          return _this.switcher.setMenuEnabled(true);
        };
      })(this));
    };

    CounterMode.prototype.startReceipt = function(code) {
      this._receipt.start();
      this.switcher.setMenuEnabled(false);
      return Api.receipt_start().then((function(_this) {
        return function(data) {
          _this._receipt.data = data;
          _this.receipt.body.empty();
          _this._setSum();
          return _this.reserveItem(code);
        };
      })(this), (function(_this) {
        return function(jqHXR) {
          alert("Could not start receipt!");
          _this._receipt.end();
          _this.switcher.setMenuEnabled(true);
          return true;
        };
      })(this));
    };

    CounterMode.prototype._setSum = function(sum, ret) {
      var text;
      if (sum == null) {
        sum = 0;
      }
      if (ret == null) {
        ret = null;
      }
      text = "Total: " + sum.formatCents() + " €";
      if (ret != null) {
        text += " / Return: " + ret.formatCents() + " €";
      }
      this.receiptSum.set(text);
      return this.receiptSum.setEnabled(this._receipt.isActive());
    };

    CounterMode.prototype.reserveItem = function(code) {
      return Api.item_reserve({
        code: code
      }).then((function(_this) {
        return function(data) {
          _this._receipt.total += data.price;
          return _this.addRow(data.code, data.name, data.price);
        };
      })(this), (function(_this) {
        return function(jqXHR) {
          _this.showError(jqXHR.status, jqXHR.responseText, code);
          return true;
        };
      })(this));
    };

    CounterMode.prototype.onRemoveItem = function(code) {
      if (!this._receipt.isActive()) {
        return;
      }
      return Api.item_release({
        code: code
      }).then((function(_this) {
        return function(data) {
          _this._receipt.total -= data.price;
          return _this.addRow(data.code, data.name, -data.price);
        };
      })(this), (function(_this) {
        return function() {
          alert("Item not found on receipt: " + code);
          return true;
        };
      })(this));
    };

    CounterMode.prototype.onPayReceipt = function(input) {
      var return_amount, row, _i, _len, _ref;
      if (!Number.isConvertible(input)) {
        return;
      }
      input = input.replace(",", ".");
      if (input.indexOf(".")) {
        input = (input - 0) * 100;
      } else {
        input = input - 0;
      }
      if (input < this._receipt.total) {
        alert("Not enough given money!");
        return;
      }
      if (input > 400 * 100) {
        alert("Not accepting THAT much money!");
        return;
      }
      this.receipt.body.children(".receipt-ending").removeClass("success").addClass("info text-muted");
      return_amount = input - this._receipt.total;
      _ref = [this.addRow(null, "Subtotal", this._receipt.total, true), this.addRow(null, "Cash", input), this.addRow(null, "Return", return_amount, true)];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        row = _ref[_i];
        row.addClass("success receipt-ending");
      }
      this._setSum(this._receipt.total, return_amount.round5());
      if (!this._receipt.isActive()) {
        return;
      }
      return Api.receipt_finish().then((function(_this) {
        return function(data) {
          _this._receipt.end(data);
          console.log(_this._receipt);
          _this.switcher.setMenuEnabled(true);
          return _this.receiptSum.setEnabled(false);
        };
      })(this), (function(_this) {
        return function() {
          alert("Error ending receipt!");
          return true;
        };
      })(this));
    };

    CounterMode.prototype.onAbortReceipt = function() {
      if (!this._receipt.isActive()) {
        return;
      }
      return Api.receipt_abort().then((function(_this) {
        return function(data) {
          _this._receipt.end(data);
          console.log(_this._receipt);
          _this.addRow(null, "Aborted", null).addClass("danger");
          _this.switcher.setMenuEnabled(true);
          return _this.receiptSum.setEnabled(false);
        };
      })(this), (function(_this) {
        return function() {
          alert("Error ending receipt!");
          return true;
        };
      })(this));
    };

    CounterMode.prototype.onLogout = function() {
      if (this._receipt.isActive()) {
        alert("Cannot logout while receipt is active!");
        return;
      }
      return Api.clerk_logout().then((function(_this) {
        return function() {
          console.log("Logged out " + _this.cfg.settings.clerkName + ".");
          _this.cfg.settings.clerkName = null;
          return _this.switcher.switchTo(ClerkLoginMode);
        };
      })(this), (function(_this) {
        return function() {
          alert("Logout failed!");
          return true;
        };
      })(this));
    };

    return CounterMode;

  })(ItemCheckoutMode);

  ReceiptData = (function() {
    function ReceiptData() {
      this.start(null);
      this.active = false;
    }

    ReceiptData.prototype.isActive = function() {
      return this.active;
    };

    ReceiptData.prototype.start = function(data) {
      if (data == null) {
        data = null;
      }
      this.active = true;
      this.rowCount = 0;
      this.total = 0;
      return this.data = data;
    };

    ReceiptData.prototype.end = function(data) {
      if (data == null) {
        data = null;
      }
      this.active = false;
      return this.data = data;
    };

    return ReceiptData;

  })();

}).call(this);

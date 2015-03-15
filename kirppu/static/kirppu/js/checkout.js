// ================ 1: util.coffee ================

(function() {
  var errorSound, stillBlinking;

  this.displayPrice = function(price, rounded) {
    var price_str, rounded_str;
    if (rounded == null) {
      rounded = false;
    }
    if (price != null) {
      if (Number.isInteger(price)) {
        price_str = price.formatCents() + " €";
      } else {
        price_str = price;
        rounded = false;
      }
    } else {
      price_str = "";
      rounded = false;
    }
    if (rounded && price.round5() !== price) {
      rounded_str = price.round5().formatCents() + " €";
      price_str = rounded_str + " (" + price_str + ")";
    }
    return price_str;
  };

  this.displayState = function(state) {
    return {
      SO: gettext('sold'),
      BR: gettext('on display'),
      ST: gettext('about to be sold'),
      MI: gettext('missing'),
      RE: gettext('returned to the vendor'),
      CO: gettext('sold and compensated to the vendor'),
      AD: gettext('not brought to the event')
    }[state];
  };

  Number.prototype.round5 = function() {
    var modulo;
    modulo = this % 5;
    if (modulo >= 2.5) {
      return this + (5 - modulo);
    } else {
      return this - modulo;
    }
  };

  stillBlinking = false;

  errorSound = new Audio("/static/kirppu/audio/error-buzzer.mp3");

  this.safeAlert = function(message, blink) {
    var blinksToGo, body, cls, text, timeCb, timeout;
    if (blink == null) {
      blink = true;
    }
    errorSound.play();
    body = CheckoutConfig.uiRef.container;
    text = CheckoutConfig.uiRef.errorText;
    cls = "alert-blink";
    text.text(message);
    text.removeClass("alert-off");
    if (!blink) {
      return;
    }
    body.addClass(cls);
    blinksToGo = CheckoutConfig.settings.alertBlinkCount * 2;
    timeout = 150;
    stillBlinking = true;
    timeCb = function() {
      body.toggleClass(cls);
      if (--blinksToGo > 0) {
        return setTimeout(timeCb, timeout);
      } else {
        stillBlinking = false;
        return body.removeClass(cls);
      }
    };
    return setTimeout(timeCb, timeout);
  };

  this.safeAlertOff = function() {
    if (stillBlinking) {
      return;
    }
    return CheckoutConfig.uiRef.errorText.addClass("alert-off");
  };

}).call(this);

// ================ 2: checkout.coffee ================

(function() {
  var Config;

  Config = (function() {
    function Config() {}

    Config.prototype.uiId = {
      container: null,
      body: null,
      errorText: null,
      glyph: null,
      stateText: null,
      subtitleText: null,
      codeInput: null,
      codeForm: null,
      modeMenu: null,
      overseerLink: null,
      dialog: null
    };

    Config.prototype.uiRef = {
      container: null,
      body: null,
      errorText: null,
      glyph: null,
      stateText: null,
      subtitleText: null,
      codeInput: null,
      codeForm: null,
      modeMenu: null,
      overseerLink: null,
      dialog: null
    };

    Config.prototype.settings = {
      itemPrefix: null,
      clerkPrefix: "::",
      counterPrefix: ":*",
      removeItemPrefix: "-",
      payPrefix: "+",
      abortPrefix: null,
      printPrefix: null,
      logoutPrefix: null,
      counterCode: null,
      clerkName: null,
      alertBlinkCount: 4
    };

    Config.prototype.check = function() {
      var element, errors, key, ref, value;
      errors = false;
      ref = this.uiId;
      for (key in ref) {
        value = ref[key];
        element = $("#" + value);
        if (!((element != null) && element.length === 1)) {
          console.error("Name " + value + " does not identify an element for " + key + ".");
          errors = true;
          continue;
        }
        this.uiRef[key] = element;
      }
      return errors;
    };

    return Config;

  })();

  window.CheckoutConfig = new Config();

  Number.FRACTION_LEN = 2;

  Number.FRACTION = Math.pow(10, Number.FRACTION_LEN);

  Number.prototype.formatCents = function() {
    var fraction, fraction_len, fraction_str, i, ignored, ref, ref1, wholes;
    wholes = Math.floor(Math.abs(this / Number.FRACTION));
    fraction = Math.abs(this % Number.FRACTION);
    fraction_str = "";
    fraction_len = ("" + fraction).length;
    for (ignored = i = ref = fraction_len, ref1 = Number.FRACTION_LEN; ref <= ref1 ? i < ref1 : i > ref1; ignored = ref <= ref1 ? ++i : --i) {
      fraction_str += "0";
    }
    fraction_str += fraction;
    if (this < 0) {
      wholes = "-" + wholes;
    }
    return wholes + "." + fraction_str;
  };

  String.prototype.parseCents = function() {
    var cents, fraction, fraction_exp, matcher, pat, wholes;
    pat = /^(-?)(\d*)(?:[,.](\d*))?$/;
    matcher = pat.exec(this);
    if (matcher == null) {
      return null;
    }
    if (matcher[1] == null) {
      matcher[1] = "";
    }
    if (matcher[2] == null) {
      matcher[2] = "0";
    }
    if (matcher[3] == null) {
      matcher[3] = "0";
    }
    wholes = matcher[2] - 0;
    fraction = matcher[3] - 0;
    fraction_exp = Math.pow(10, Number.FRACTION_LEN - matcher[3].length);
    fraction = Math.round(fraction * fraction_exp);
    cents = wholes * Number.FRACTION;
    if (matcher[1] !== "-") {
      cents += fraction;
    } else {
      cents = -cents - fraction;
    }
    return cents;
  };

}).call(this);

// ================ 3: datetime_formatter.coffee ================

(function() {
  this.DateTimeFormatter = (function() {
    function DateTimeFormatter() {}

    DateTimeFormatter.timeZone = null;

    DateTimeFormatter.locales = null;

    DateTimeFormatter.init = function(locales, timeZone) {
      if (locales == null) {
        locales = void 0;
      }
      if (timeZone == null) {
        timeZone = void 0;
      }
      if ((locales != null) && (timeZone != null)) {
        this.locales = locales;
        this.timeZone = timeZone;
      }
      return moment.locale(this.locales);
    };

    DateTimeFormatter.date = function(value) {
      return moment(value).format("L");
    };

    DateTimeFormatter.time = function(value) {
      return moment(value).format("LTS");
    };

    DateTimeFormatter.datetime = function(value) {
      return moment(value).format("L LTS");
    };

    return DateTimeFormatter;

  })();

}).call(this);

// ================ 4: dialog.coffee ================

(function() {
  this.Dialog = (function() {
    function Dialog(template, title) {
      if (template == null) {
        template = "#dialog_template";
      }
      if (title == null) {
        title = "#dialog_template_label";
      }
      this.container = $(template);
      this.title = this.container.find(title);
      this.body = this.container.find(".modal-body");
      this.buttons = this.container.find(".modal-footer");
      this.title.empty();
      this.body.empty();
      this.buttons.empty();
      this.btnPositive = null;
      this.btnNegative = null;
    }

    Dialog.prototype.addPositive = function(clazz) {
      if (clazz == null) {
        clazz = "success";
      }
      return this.btnPositive = this._button(clazz);
    };

    Dialog.prototype.addNegative = function(clazz) {
      if (clazz == null) {
        clazz = "default";
      }
      return this.btnNegative = this._button(clazz);
    };

    Dialog.prototype.setEnabled = function(button, enabled) {
      if (enabled == null) {
        enabled = true;
      }
      if (enabled) {
        return button.removeAttr("disabled");
      } else {
        return button.attr("disabled", "disabled");
      }
    };

    Dialog.prototype.show = function(modalArgs) {
      if (modalArgs == null) {
        modalArgs = {
          keyboard: false
        };
      }
      if (this.btnPositive != null) {
        this.buttons.append(this.btnPositive);
      }
      if (this.btnNegative != null) {
        this.buttons.append(this.btnNegative);
      }
      return this.container.modal(modalArgs);
    };

    Dialog.prototype._button = function(clazz) {
      if (clazz == null) {
        clazz = "default";
      }
      return $("<button type=\"button\" class=\"btn btn-" + clazz + "\" data-dismiss=\"modal\">");
    };

    return Dialog;

  })();

}).call(this);

// ================ 5: resulttable.coffee ================

(function() {
  this.ResultTable = (function() {
    function ResultTable(caption) {
      this.dom = $('<table class="table table-striped table-hover table-condensed">');
      if (caption != null) {
        this.dom.append($('<caption class="h3">').text(caption));
      }
      this.head = $('<tr>');
      this.body = $('<tbody>');
      this.dom.append($('<thead>').append(this.head), this.body);
    }

    ResultTable.prototype.render = function() {
      return this.dom;
    };

    return ResultTable;

  })();

}).call(this);

// ================ 6: itemreceipttable.coffee ================

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  this.ItemReceiptTable = (function(superClass) {
    extend(ItemReceiptTable, superClass);

    function ItemReceiptTable() {
      ItemReceiptTable.__super__.constructor.apply(this, arguments);
      this.head.append(['<th class="receipt_index">#</th>', '<th class="receipt_code">' + gettext('code') + '</th>', '<th class="receipt_item">' + gettext('item') + '</th>', '<th class="receipt_price">' + gettext('price') + '</th>'].map($));
    }

    return ItemReceiptTable;

  })(ResultTable);

}).call(this);

// ================ 7: itemreporttable.coffee ================

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  this.ItemReportTable = (function(superClass) {
    extend(ItemReportTable, superClass);

    function ItemReportTable() {
      var c;
      ItemReportTable.__super__.constructor.apply(this, arguments);
      this.columns = [
        {
          title: gettext('#'),
          render: function(_, index) {
            return index + 1;
          },
          "class": 'receipt_index numeric'
        }, {
          title: gettext('code'),
          render: function(i) {
            return i.code;
          },
          "class": 'receipt_code'
        }, {
          title: gettext('item'),
          render: function(i) {
            return i.name;
          },
          "class": 'receipt_item'
        }, {
          title: gettext('price'),
          render: function(i) {
            return displayPrice(i.price);
          },
          "class": 'receipt_price numeric'
        }, {
          title: gettext('status'),
          render: function(i) {
            return displayState(i.state);
          },
          "class": 'receipt_status'
        }
      ];
      this.head.append((function() {
        var j, len, ref, results;
        ref = this.columns;
        results = [];
        for (j = 0, len = ref.length; j < len; j++) {
          c = ref[j];
          results.push($('<th>').text(c.title).addClass(c["class"]));
        }
        return results;
      }).call(this));
    }

    ItemReportTable.prototype.update = function(items) {
      var c, index, item, j, len, row, sum;
      this.body.empty();
      sum = 0;
      for (index = j = 0, len = items.length; j < len; index = ++j) {
        item = items[index];
        sum += item.price;
        row = $('<tr>').append((function() {
          var k, len1, ref, results;
          ref = this.columns;
          results = [];
          for (k = 0, len1 = ref.length; k < len1; k++) {
            c = ref[k];
            results.push($('<td>').text(c.render(item, index)).addClass(c["class"]));
          }
          return results;
        }).call(this));
        this.body.append(row);
      }
      return this.body.append($('<tr>').append($('<th colspan="3">').text(gettext('Total:')), $('<th class="receipt_price numeric">').text(displayPrice(sum)), $('<th>')));
    };

    return ItemReportTable;

  })(ResultTable);

}).call(this);

// ================ 8: vendorlist.coffee ================

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  this.VendorList = (function(superClass) {
    extend(VendorList, superClass);

    function VendorList() {
      VendorList.__super__.constructor.apply(this, arguments);
      this.head.append(['<th class="receipt_index">#</th>', '<th class="receipt_username">username</th>', '<th class="receipt_vendor_id">id</th>', '<th class="receipt_name">name</th>', '<th class="receipt_email">email</th>', '<th class="receipt_phone">phone</th>'].map($));
    }

    VendorList.prototype.append = function(vendor, index, action) {
      var a, row;
      row = $("<tr>");
      row.addClass('receipt_tr_clickable');
      row.append($("<td>").text(index));
      row.append((function() {
        var i, len, ref, results;
        ref = ['username', 'id', 'name', 'email', 'phone'];
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          a = ref[i];
          results.push($("<td>").text(vendor[a]));
        }
        return results;
      })());
      row.click(action);
      return this.body.append(row);
    };

    return VendorList;

  })(ResultTable);

}).call(this);

// ================ 9: vendorinfo.coffee ================

(function() {
  this.VendorInfo = (function() {
    function VendorInfo(vendor) {
      var attr, i, len, list, ref;
      this.dom = $('<div class="vendor-info-box">');
      this.dom.append($('<h3>').text(gettext('Vendor')));
      list = $('<dl class="dl-horizontal">');
      ref = ['name', 'email', 'phone', 'id'];
      for (i = 0, len = ref.length; i < len; i++) {
        attr = ref[i];
        list.append($('<dt>').text(attr));
        list.append($('<dd>').text(vendor[attr]));
      }
      this.dom.append(list);
    }

    VendorInfo.prototype.render = function() {
      return this.dom;
    };

    return VendorInfo;

  })();

}).call(this);

// ================ 10: receiptsum.coffee ================

(function() {
  this.ReceiptSum = (function() {
    function ReceiptSum() {
      this.dom = $('<p class="lead text-right">');
    }

    ReceiptSum.prototype.render = function() {
      return this.dom;
    };

    ReceiptSum.prototype.set = function(sum) {
      return this.dom.text(sum);
    };

    ReceiptSum.prototype.setEnabled = function(enabled) {
      if (enabled == null) {
        enabled = true;
      }
      return setClass(this.dom, "text-muted", !enabled);
    };

    return ReceiptSum;

  })();

}).call(this);

// ================ 11: printreceipttable.coffee ================

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  this.PrintReceiptTable = (function(superClass) {
    extend(PrintReceiptTable, superClass);

    PrintReceiptTable.strCode = "code";

    PrintReceiptTable.strItem = "item";

    PrintReceiptTable.strPrice = "price";

    PrintReceiptTable.strVendor = "vendor";

    function PrintReceiptTable() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      PrintReceiptTable.__super__.constructor.apply(this, args);
      this.head.append(["<th class=\"receipt_vendor_id\">" + this.constructor.strVendor + "</th>", "<th class=\"receipt_code\">" + this.constructor.strCode + "</th>", "<th class=\"receipt_item\">" + this.constructor.strItem + "</th>", "<th class=\"receipt_price\">" + this.constructor.strPrice + "</th>"].map($));
    }

    PrintReceiptTable.joinedLine = function(text, html) {
      if (text == null) {
        text = "";
      }
      if (html == null) {
        html = false;
      }
      return $("<tr>").append($('<td colspan="4">')[html ? "html" : "text"](text));
    };

    PrintReceiptTable.createRow = function() {
      var args, i, j, len, price, ref, rounded, row, x;
      args = 3 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 2) : (i = 0, []), price = arguments[i++], rounded = arguments[i++];
      row = $("<tr>");
      ref = slice.call(args).concat([displayPrice(price, rounded)]);
      for (j = 0, len = ref.length; j < len; j++) {
        x = ref[j];
        row.append($("<td>").text(x));
      }
      return row;
    };

    return PrintReceiptTable;

  })(ResultTable);

}).call(this);

// ================ 12: modeswitcher.coffee ================

(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  this.setClass = function(element, cls, enabled) {
    if (element.hasClass(cls) !== enabled) {
      if (enabled) {
        element.addClass(cls);
      } else {
        element.removeClass(cls);
      }
    }
    return element;
  };

  this.ModeSwitcher = (function() {
    ModeSwitcher.entryPoints = {};

    ModeSwitcher.registerEntryPoint = function(name, mode) {
      if (name in this.entryPoints) {
        return console.error("Name '" + name + "' was already registered for '" + this.entryPoints[name].name + "' while registering '" + mode.name + "'.");
      } else {
        return this.entryPoints[name] = mode;
      }
    };

    function ModeSwitcher(config) {
      this._onFormSubmit = bind(this._onFormSubmit, this);
      var regainFocus;
      this.cfg = config ? config : CheckoutConfig;
      this._currentMode = null;
      this._bindMenu(ModeSwitcher.entryPoints);
      this._bindForm();
      regainFocus = (function(_this) {
        return function() {
          var timeoutFocus;
          timeoutFocus = function() {
            return _this.cfg.uiRef.codeInput.focus();
          };
          return setTimeout(timeoutFocus, 0);
        };
      })(this);
      this.cfg.uiRef.dialog.on("hidden.bs.modal", regainFocus);
      $("#help_dialog").on("hidden.bs.modal", regainFocus);
    }

    ModeSwitcher.prototype.startDefault = function() {
      return this.switchTo(ModeSwitcher.entryPoints["counter_validation"]);
    };

    ModeSwitcher.prototype.switchTo = function(mode, params) {
      if (params == null) {
        params = null;
      }
      if (this._currentMode != null) {
        this._currentMode.exit();
      }
      this.setMenuEnabled(true);
      this._currentMode = new mode(this, this.cfg, params);
      safeAlertOff();
      this.cfg.uiRef.container.removeClass().addClass('container').addClass('color-mode');
      this.cfg.uiRef.container.addClass('color-' + this._currentMode.constructor.name);
      this.cfg.uiRef.body.empty();
      this.cfg.uiRef.glyph.removeClass().addClass('glyphicon');
      if (this._currentMode.glyph()) {
        this.cfg.uiRef.glyph.addClass("glyphicon-" + this._currentMode.glyph());
        this.cfg.uiRef.glyph.addClass("hidden-print");
      }
      this.cfg.uiRef.stateText.text(this._currentMode.title());
      this.cfg.uiRef.subtitleText.text(this._currentMode.subtitle() || "");
      this.cfg.uiRef.codeInput.attr("placeholder", this._currentMode.inputPlaceholder());
      this._currentMode.enter();
      return this.cfg.uiRef.codeInput.focus();
    };

    ModeSwitcher.prototype._bindForm = function() {
      var form;
      form = this.cfg.uiRef.codeForm;
      form.off("submit");
      return form.submit(this._onFormSubmit);
    };

    ModeSwitcher.prototype._onFormSubmit = function(event) {
      var a, actions, handler, input, matching, prefix, ref;
      event.preventDefault();
      input = this.cfg.uiRef.codeInput.val();
      actions = this._currentMode.actions();
      matching = (function() {
        var i, len, results;
        results = [];
        for (i = 0, len = actions.length; i < len; i++) {
          a = actions[i];
          if (input.indexOf(a[0]) === 0) {
            results.push(a);
          }
        }
        return results;
      })();
      matching = matching.sort(function(a, b) {
        return b[0].length - a[0].length;
      });
      if (matching[0] != null) {
        ref = matching[0], prefix = ref[0], handler = ref[1];
        if (input.trim().length > 0) {
          safeAlertOff();
        }
        handler(input.slice(prefix.length), prefix);
      } else {
        console.error("Input not accepted: '" + input + "'.");
      }
      this.cfg.uiRef.codeInput.val("");
    };

    ModeSwitcher.prototype._bindMenu = function(entryPoints) {
      var entryPoint, entryPointName, i, item, itemDom, items, len, menu;
      menu = this.cfg.uiRef.modeMenu;
      items = menu.find("[data-entrypoint]");
      for (i = 0, len = items.length; i < len; i++) {
        itemDom = items[i];
        item = $(itemDom);
        entryPointName = item.attr("data-entrypoint");
        if (entryPointName in entryPoints) {
          entryPoint = entryPoints[entryPointName];
          (function(this_, ep) {
            return item.click(function() {
              console.log("Changing mode from menu to " + ep.name);
              return this_.switchTo(ep);
            });
          })(this, entryPoint);
        } else {
          console.warn("Entry point '" + entryPointName + "' could not be found from registered entry points. Source:");
          console.log(itemDom);
        }
      }
    };

    ModeSwitcher.prototype.setMenuEnabled = function(enabled) {
      var menu;
      menu = this.cfg.uiRef.modeMenu;
      setClass(menu, "disabled", !enabled);
      return setClass(menu.find("a:first"), "disabled", !enabled);
    };

    ModeSwitcher.prototype.setOverseerEnabled = function(enabled) {
      return setClass(this.cfg.uiRef.overseerLink, 'hidden', !enabled);
    };

    return ModeSwitcher;

  })();

}).call(this);

// ================ 13: checkoutmode.coffee ================

(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  this.CheckoutMode = (function() {
    function CheckoutMode(switcher, config) {
      this.onLogout = bind(this.onLogout, this);
      this.switcher = switcher;
      this.cfg = config ? config : CheckoutConfig;
    }

    CheckoutMode.prototype.glyph = function() {
      return "";
    };

    CheckoutMode.prototype.title = function() {
      return "[unknown mode]";
    };

    CheckoutMode.prototype.subtitle = function() {
      return this.cfg.settings.clerkName + " @ " + this.cfg.settings.counterName;
    };

    CheckoutMode.prototype.inputPlaceholder = function() {
      return "Barcode";
    };

    CheckoutMode.prototype.enter = function() {};

    CheckoutMode.prototype.exit = function() {};

    CheckoutMode.prototype.actions = function() {
      return [["", function() {}]];
    };

    CheckoutMode.prototype.onLogout = function() {
      return Api.clerk_logout().then((function(_this) {
        return function() {
          console.log("Logged out " + _this.cfg.settings.clerkName + ".");
          _this.cfg.settings.clerkName = null;
          _this.switcher.setOverseerEnabled(false);
          return _this.switcher.switchTo(ClerkLoginMode);
        };
      })(this), (function(_this) {
        return function() {
          safeAlert("Logout failed!");
          return true;
        };
      })(this));
    };

    return CheckoutMode;

  })();

}).call(this);

// ================ 14: itemcheckoutmode.coffee ================

(function() {
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  this.ItemCheckoutMode = (function(superClass) {
    extend(ItemCheckoutMode, superClass);

    function ItemCheckoutMode() {
      ItemCheckoutMode.__super__.constructor.apply(this, arguments);
      this.receipt = new ItemReceiptTable();
    }

    ItemCheckoutMode.prototype.enter = function() {
      ItemCheckoutMode.__super__.enter.apply(this, arguments);
      return this.cfg.uiRef.body.append(this.receipt.render());
    };

    ItemCheckoutMode.prototype.createRow = function(index, code, name, price, rounded) {
      var i, len, ref, row, x;
      if (price == null) {
        price = null;
      }
      if (rounded == null) {
        rounded = false;
      }
      row = $('<tr id="' + code + '">');
      ref = [index, code, name, displayPrice(price, rounded)];
      for (i = 0, len = ref.length; i < len; i++) {
        x = ref[i];
        row.append($("<td>").text(x));
      }
      return row;
    };

    return ItemCheckoutMode;

  })(CheckoutMode);

}).call(this);

// ================ 15: countervalidationmode.coffee ================

(function() {
  var b64_to_utf8, utf8_to_b64,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  utf8_to_b64 = function(str) {
    return window.btoa(encodeURIComponent(escape(str)));
  };

  b64_to_utf8 = function(str) {
    return unescape(decodeURIComponent(window.atob(str)));
  };

  this.CounterValidationMode = (function(superClass) {
    extend(CounterValidationMode, superClass);

    function CounterValidationMode() {
      this.onResultError = bind(this.onResultError, this);
      this.onResultSuccess = bind(this.onResultSuccess, this);
      return CounterValidationMode.__super__.constructor.apply(this, arguments);
    }

    ModeSwitcher.registerEntryPoint("counter_validation", CounterValidationMode);

    CounterValidationMode.COOKIE = "mCV";

    CounterValidationMode.prototype.title = function() {
      return "Locked";
    };

    CounterValidationMode.prototype.subtitle = function() {
      return "Need to validate counter.";
    };

    CounterValidationMode.prototype.enter = function() {
      var code, data;
      CounterValidationMode.__super__.enter.apply(this, arguments);
      this.switcher.setMenuEnabled(false);
      code = $.cookie(this.constructor.COOKIE);
      if (code != null) {
        data = JSON.parse(b64_to_utf8(code));
        return this.onResultSuccess(data);
      }
    };

    CounterValidationMode.prototype.actions = function() {
      return [
        [
          this.cfg.settings.counterPrefix, (function(_this) {
            return function(code) {
              return Api.counter_validate({
                code: code
              }).then(_this.onResultSuccess, _this.onResultError);
            };
          })(this)
        ]
      ];
    };

    CounterValidationMode.prototype.onResultSuccess = function(data) {
      var code, name;
      code = data["counter"];
      name = data["name"];
      this.cfg.settings.counterCode = code;
      this.cfg.settings.counterName = name;
      console.log("Validated " + code + " as " + name + ".");
      $.cookie(this.constructor.COOKIE, utf8_to_b64(JSON.stringify({
        counter: code,
        name: name
      })));
      return this.switcher.switchTo(ClerkLoginMode);
    };

    CounterValidationMode.prototype.onResultError = function(jqXHR) {
      if (jqXHR.status === 419) {
        console.log("Invalid counter code supplied.");
        return;
      }
      alert("Error:" + jqXHR.responseText);
      return true;
    };

    CounterValidationMode.clearStore = function() {
      return $.removeCookie(this.COOKIE);
    };

    return CounterValidationMode;

  })(CheckoutMode);

}).call(this);

// ================ 16: clerkloginmode.coffee ================

(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  this.ClerkLoginMode = (function(superClass) {
    extend(ClerkLoginMode, superClass);

    function ClerkLoginMode() {
      this.onResultError = bind(this.onResultError, this);
      this.onResultSuccess = bind(this.onResultSuccess, this);
      return ClerkLoginMode.__super__.constructor.apply(this, arguments);
    }

    ModeSwitcher.registerEntryPoint("clerk_login", ClerkLoginMode);

    ClerkLoginMode.prototype.title = function() {
      return "Locked";
    };

    ClerkLoginMode.prototype.subtitle = function() {
      return "Login...";
    };

    ClerkLoginMode.prototype.enter = function() {
      ClerkLoginMode.__super__.enter.apply(this, arguments);
      return this.switcher.setMenuEnabled(false);
    };

    ClerkLoginMode.prototype.actions = function() {
      return [
        [
          this.cfg.settings.clerkPrefix, (function(_this) {
            return function(code, prefix) {
              return Api.clerk_login({
                code: prefix + code,
                counter: _this.cfg.settings.counterCode
              }).then(_this.onResultSuccess, _this.onResultError);
            };
          })(this)
        ]
      ];
    };

    ClerkLoginMode.prototype.onResultSuccess = function(data) {
      var username;
      username = data["user"];
      this.cfg.settings.clerkName = username;
      console.log("Logged in as " + username + ".");
      this.switcher.setOverseerEnabled(data["overseer_enabled"]);
      if (data["receipts"] != null) {
        return this.multipleReceipts(data["receipts"]);
      } else if (data["receipt"] != null) {
        return this.activateReceipt(data["receipt"]);
      } else {
        return this.switcher.switchTo(CounterMode);
      }
    };

    ClerkLoginMode.prototype.onResultError = function(jqXHR) {
      if (jqXHR.status === 419) {
        console.log("Login failed: " + jqXHR.responseText);
        return;
      }
      safeAlert("Error:" + jqXHR.responseText);
      return true;
    };

    ClerkLoginMode.prototype.activateReceipt = function(receipt) {
      return this.switcher.switchTo(CounterMode, receipt);
    };

    ClerkLoginMode.prototype.multipleReceipts = function(receipts) {
      var dialog, info, table, table_body;
      dialog = new Dialog();
      dialog.title.html('<span class="glyphicon glyphicon-warning-sign text-warning"></span> Multiple receipts active');
      info = $("<div>").text("Please select receipt, which you want to continue.");
      table_body = $("<tbody>");
      this._createReceiptTable(receipts, dialog, table_body);
      table = $('<table class="table table-striped table-hover table-condensed">').append(table_body);
      dialog.body.append(info, table);
      dialog.addPositive().text("Select").click((function(_this) {
        return function() {
          var index;
          index = table_body.find(".success").data("index");
          if (index != null) {
            console.log(("Selected " + (1 + index) + ": ") + receipts[index].start_time);
            return _this.switcher.switchTo(CounterMode, receipts[index]);
          }
        };
      })(this));
      dialog.setEnabled(dialog.btnPositive, false);
      dialog.addNegative().text("Cancel").click(function() {
        return console.log("Cancelled receipt selection");
      });
      return dialog.show({
        keyboard: false,
        backdrop: "static"
      });
    };

    ClerkLoginMode.prototype._createReceiptTable = function(receipts, dialog, table_body) {
      var i, j, len, receipt, row;
      for (i = j = 0, len = receipts.length; j < len; i = ++j) {
        receipt = receipts[i];
        row = $("<tr>");
        row.append($("<td>").text(i + 1), $("<td>").text(DateTimeFormatter.datetime(receipt.start_time)), $("<td>").text(receipt.total.formatCents()), $("<td>").text(receipt.counter));
        row.click(function() {
          table_body.find(".success").removeClass("success");
          $(this).addClass("success");
          return dialog.setEnabled(dialog.btnPositive);
        });
        row.data("index", i);
        table_body.append(row);
      }
      return table_body;
    };

    return ClerkLoginMode;

  })(CheckoutMode);

}).call(this);

// ================ 17: itemcheckinmode.coffee ================

(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  this.ItemCheckInMode = (function(superClass) {
    extend(ItemCheckInMode, superClass);

    ModeSwitcher.registerEntryPoint("vendor_check_in", ItemCheckInMode);

    ItemCheckInMode.prototype.glyph = function() {
      return "import";
    };

    ItemCheckInMode.prototype.title = function() {
      return "Vendor Check-In";
    };

    function ItemCheckInMode() {
      var args, i, query;
      args = 2 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 1) : (i = 0, []), query = arguments[i++];
      this.onResultError = bind(this.onResultError, this);
      this.onResultSuccess = bind(this.onResultSuccess, this);
      ItemCheckInMode.__super__.constructor.apply(this, arguments);
      this.currentVendor = null;
    }

    ItemCheckInMode.prototype.actions = function() {
      return [
        [
          '', (function(_this) {
            return function(code) {
              return Api.item_checkin({
                code: code
              }).then(_this.onResultSuccess, _this.onResultError);
            };
          })(this)
        ], [this.cfg.settings.logoutPrefix, this.onLogout]
      ];
    };

    ItemCheckInMode.prototype.onResultSuccess = function(data) {
      var row;
      if (data.vendor !== this.currentVendor) {
        this.currentVendor = data.vendor;
        return Api.vendor_get({
          id: this.currentVendor
        }).done((function(_this) {
          return function(vendor) {
            var row;
            _this.receipt.body.prepend(new VendorInfo(vendor).render());
            row = _this.createRow("", data.code, data.name, data.price);
            return _this.receipt.body.prepend(row);
          };
        })(this));
      } else {
        row = this.createRow("", data.code, data.name, data.price);
        return this.receipt.body.prepend(row);
      }
    };

    ItemCheckInMode.prototype.onResultError = function(jqXHR) {
      if (jqXHR.status === 404) {
        safeAlert("No such item");
        return;
      }
      safeAlert("Error:" + jqXHR.responseText);
      return true;
    };

    return ItemCheckInMode;

  })(ItemCheckoutMode);

}).call(this);

// ================ 18: vendorcheckoutmode.coffee ================

(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  this.VendorCheckoutMode = (function(superClass) {
    extend(VendorCheckoutMode, superClass);

    ModeSwitcher.registerEntryPoint("vendor_check_out", VendorCheckoutMode);

    function VendorCheckoutMode(cfg, switcher, vendor) {
      this.onCheckedOut = bind(this.onCheckedOut, this);
      this.onItemFound = bind(this.onItemFound, this);
      this.returnItem = bind(this.returnItem, this);
      this.onGotItems = bind(this.onGotItems, this);
      VendorCheckoutMode.__super__.constructor.call(this, cfg, switcher);
      this.vendorId = vendor != null ? vendor.id : null;
      this.receipt = new ItemReceiptTable('Returned items');
      this.lastItem = new ItemReceiptTable();
      this.remainingItems = new ItemReceiptTable('Remaining items');
    }

    VendorCheckoutMode.prototype.enter = function() {
      VendorCheckoutMode.__super__.enter.apply(this, arguments);
      this.cfg.uiRef.body.prepend(this.remainingItems.render());
      this.cfg.uiRef.body.prepend(this.lastItem.render());
      if (this.vendorId != null) {
        return this.addVendorInfo();
      }
    };

    VendorCheckoutMode.prototype.glyph = function() {
      return "export";
    };

    VendorCheckoutMode.prototype.title = function() {
      return "Vendor Check-Out";
    };

    VendorCheckoutMode.prototype.actions = function() {
      return [['', this.returnItem], [this.cfg.settings.logoutPrefix, this.onLogout]];
    };

    VendorCheckoutMode.prototype.addVendorInfo = function() {
      Api.vendor_get({
        id: this.vendorId
      }).done((function(_this) {
        return function(vendor) {
          _this.cfg.uiRef.body.prepend($('<input type="button">').addClass('btn btn-primary').attr('value', 'Open Report').click(function() {
            return _this.switcher.switchTo(VendorReport, vendor);
          }));
          return _this.cfg.uiRef.body.prepend(new VendorInfo(vendor).render());
        };
      })(this));
      return Api.item_list({
        vendor: this.vendorId
      }).done(this.onGotItems);
    };

    VendorCheckoutMode.prototype.onGotItems = function(items) {
      var i, item, j, len, len1, remaining, results, returned, row;
      remaining = {
        BR: 0,
        ST: 0,
        MI: 0
      };
      for (i = 0, len = items.length; i < len; i++) {
        item = items[i];
        if (!(remaining[item.state] != null)) {
          continue;
        }
        row = this.createRow("", item.code, item.name, item.price);
        this.remainingItems.body.prepend(row);
      }
      returned = {
        RE: 0,
        CO: 0
      };
      results = [];
      for (j = 0, len1 = items.length; j < len1; j++) {
        item = items[j];
        if (!(returned[item.state] != null)) {
          continue;
        }
        row = this.createRow("", item.code, item.name, item.price);
        results.push(this.receipt.body.prepend(row));
      }
      return results;
    };

    VendorCheckoutMode.prototype.returnItem = function(code) {
      return Api.item_find({
        code: code
      }).then(this.onItemFound, function() {
        return safeAlert("Item not found: " + code);
      });
    };

    VendorCheckoutMode.prototype.onItemFound = function(item) {
      if (this.vendorId == null) {
        this.vendorId = item.vendor;
        this.addVendorInfo();
      } else if (this.vendorId !== item.vendor) {
        safeAlert("Someone else's item!");
        return;
      }
      return Api.item_checkout({
        code: item.code
      }).then(this.onCheckedOut, function(jqHXR) {
        return safeAlert(jqHXR.responseText);
      });
    };

    VendorCheckoutMode.prototype.onCheckedOut = function(item) {
      this.receipt.body.prepend($('tr', this.lastItem.body));
      return this.lastItem.body.prepend($('#' + item.code, this.remainingItems.body));
    };

    return VendorCheckoutMode;

  })(ItemCheckoutMode);

}).call(this);

// ================ 19: countermode.coffee ================

(function() {
  var ReceiptData,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  this.CounterMode = (function(superClass) {
    extend(CounterMode, superClass);

    ModeSwitcher.registerEntryPoint("customer_checkout", CounterMode);

    function CounterMode() {
      var args, i, modeArgs;
      args = 2 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 1) : (i = 0, []), modeArgs = arguments[i++];
      this.onLogout = bind(this.onLogout, this);
      this.onPrintReceipt = bind(this.onPrintReceipt, this);
      this.onAbortReceipt = bind(this.onAbortReceipt, this);
      this.onPayReceipt = bind(this.onPayReceipt, this);
      this.onRemoveItem = bind(this.onRemoveItem, this);
      this.showError = bind(this.showError, this);
      this.onAddItem = bind(this.onAddItem, this);
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
      return [[this.cfg.settings.abortPrefix, this.onAbortReceipt], [this.cfg.settings.printPrefix, this.onPrintReceipt], [this.cfg.settings.logoutPrefix, this.onLogout], [this.cfg.settings.payPrefix, this.onPayReceipt], [this.cfg.settings.removeItemPrefix, this.onRemoveItem], ["", this.onAddItem]];
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
      return safeAlert(errorMsg + ' ' + code);
    };

    CounterMode.prototype.restoreReceipt = function(receipt) {
      this.switcher.setMenuEnabled(false);
      return Api.receipt_activate({
        id: receipt.id
      }).then((function(_this) {
        return function(data) {
          var i, item, len, price, ref;
          _this._receipt.start(data);
          _this._receipt.total = data.total;
          _this.receipt.body.empty();
          ref = data.items;
          for (i = 0, len = ref.length; i < len; i++) {
            item = ref[i];
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
          safeAlert("Could not start receipt!");
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
          safeAlert("Item not found on receipt: " + code);
          return true;
        };
      })(this));
    };

    CounterMode.prototype.onPayReceipt = function(input) {
      var i, len, ref, return_amount, row;
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
        safeAlert("Not enough given money!");
        return;
      }
      if (input > 400 * 100) {
        safeAlert("Not accepting THAT much money!");
        return;
      }
      this.receipt.body.children(".receipt-ending").removeClass("success").addClass("info text-muted");
      return_amount = input - this._receipt.total;
      ref = [this.addRow(null, "Subtotal", this._receipt.total, true), this.addRow(null, "Cash", input), this.addRow(null, "Return", return_amount, true)];
      for (i = 0, len = ref.length; i < len; i++) {
        row = ref[i];
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
          safeAlert("Error ending receipt!");
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
          safeAlert("Error ending receipt!");
          return true;
        };
      })(this));
    };

    CounterMode.prototype.onPrintReceipt = function() {
      if (this._receipt.isActive()) {
        safeAlert("Cannot print while receipt is active!");
        return;
      }
      return Api.receipt_get({
        id: this._receipt.data.id
      }).then((function(_this) {
        return function(data) {
          return console.log(data);
        };
      })(this), (function(_this) {
        return function() {
          safeAlert("Error printing receipt!");
          return true;
        };
      })(this));
    };

    CounterMode.prototype.onLogout = function() {
      if (this._receipt.isActive()) {
        safeAlert("Cannot logout while receipt is active!");
        return;
      }
      return CounterMode.__super__.onLogout.apply(this, arguments);
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

// ================ 20: receiptprintmode.coffee ================

(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  this.ReceiptPrintMode = (function(superClass) {
    extend(ReceiptPrintMode, superClass);

    ModeSwitcher.registerEntryPoint("reports", ReceiptPrintMode);

    ReceiptPrintMode.strTotal = "Total";

    ReceiptPrintMode.strTitle = "Find receipt";

    ReceiptPrintMode.strSell = "%d, served by %c";

    function ReceiptPrintMode() {
      this.findReceipt = bind(this.findReceipt, this);
      ReceiptPrintMode.__super__.constructor.apply(this, arguments);
      this.receipt = new PrintReceiptTable();
    }

    ReceiptPrintMode.prototype.enter = function() {
      ReceiptPrintMode.__super__.enter.apply(this, arguments);
      return this.cfg.uiRef.body.append(this.receipt.render());
    };

    ReceiptPrintMode.prototype.glyph = function() {
      return "list-alt";
    };

    ReceiptPrintMode.prototype.title = function() {
      return this.constructor.strTitle;
    };

    ReceiptPrintMode.prototype.subtitle = function() {
      return "";
    };

    ReceiptPrintMode.prototype.actions = function() {
      return [["", this.findReceipt], [this.cfg.settings.logoutPrefix, this.onLogout]];
    };

    ReceiptPrintMode.prototype.findReceipt = function(code) {
      return Api.receipt_get({
        item: code
      }).then((function(_this) {
        return function(data) {
          return _this.renderReceipt(data);
        };
      })(this), (function(_this) {
        return function() {
          return safeAlert("Item not found in receipt!");
        };
      })(this));
    };

    ReceiptPrintMode.prototype.renderReceipt = function(receiptData) {
      var i, item, j, len, len1, ref, ref1, replacer, results, row, sellFmt, sellStr;
      this.receipt.body.empty();
      ref = receiptData.items;
      for (i = 0, len = ref.length; i < len; i++) {
        item = ref[i];
        if (item.action !== "ADD") {
          continue;
        }
        row = PrintReceiptTable.createRow(item.vendor, item.code, item.name, item.price, false);
        this.receipt.body.append(row);
      }
      replacer = function(s) {
        switch (s[1]) {
          case 'd':
            return DateTimeFormatter.datetime(receiptData.sell_time);
          case 'c':
            return receiptData.clerk.print;
          default:
            return s[1];
        }
      };
      sellFmt = /%[dc%]/g;
      sellStr = this.constructor.strSell.replace(sellFmt, replacer);
      ref1 = [this.constructor.middleLine, PrintReceiptTable.createRow("", "", this.constructor.strTotal, receiptData.total, true), PrintReceiptTable.joinedLine(sellStr)].concat(this.constructor.tailLines);
      results = [];
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        row = ref1[j];
        results.push(this.receipt.body.append(row));
      }
      return results;
    };

    ReceiptPrintMode.middleLine = PrintReceiptTable.joinedLine();

    ReceiptPrintMode.tailLines = [PrintReceiptTable.joinedLine()];

    return ReceiptPrintMode;

  })(CheckoutMode);

}).call(this);

// ================ 21: vendorcompensation.coffee ================

(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  this.VendorCompensation = (function(superClass) {
    extend(VendorCompensation, superClass);

    function VendorCompensation(cfg, switcher, vendor) {
      this.onConfirm = bind(this.onConfirm, this);
      this.onCancel = bind(this.onCancel, this);
      this.onGotItems = bind(this.onGotItems, this);
      VendorCompensation.__super__.constructor.call(this, cfg, switcher);
      this.vendor = vendor;
    }

    VendorCompensation.prototype.title = function() {
      return "Vendor Compensation";
    };

    VendorCompensation.prototype.enter = function() {
      VendorCompensation.__super__.enter.apply(this, arguments);
      this.cfg.uiRef.codeForm.hide();
      this.switcher.setMenuEnabled(false);
      this.cfg.uiRef.body.append(new VendorInfo(this.vendor).render());
      this.buttonForm = $('<form class="hidden-print">').append(this.abortButton());
      this.cfg.uiRef.body.append(this.buttonForm);
      this.itemDiv = $('<div>');
      this.cfg.uiRef.body.append(this.itemDiv);
      return Api.item_list({
        vendor: this.vendor.id
      }).done(this.onGotItems);
    };

    VendorCompensation.prototype.exit = function() {
      this.cfg.uiRef.codeForm.show();
      this.switcher.setMenuEnabled(true);
      return VendorCompensation.__super__.exit.apply(this, arguments);
    };

    VendorCompensation.prototype.confirmButton = function() {
      return $('<input type="button" class="btn btn-success">').attr('value', 'Confirm').click(this.onConfirm);
    };

    VendorCompensation.prototype.abortButton = function() {
      return $('<input type="button" class="btn btn-default">').attr('value', 'Cancel').click(this.onCancel);
    };

    VendorCompensation.prototype.continueButton = function() {
      return $('<input type="button" class="btn btn-primary">').attr('value', 'Continue').click(this.onCancel);
    };

    VendorCompensation.prototype.onGotItems = function(items) {
      var i, table;
      this.compensableItems = (function() {
        var j, len, results;
        results = [];
        for (j = 0, len = items.length; j < len; j++) {
          i = items[j];
          if (i.state === 'SO') {
            results.push(i);
          }
        }
        return results;
      })();
      if (this.compensableItems.length > 0) {
        table = new ItemReportTable('Sold Items');
        table.update(this.compensableItems);
        this.itemDiv.empty().append(table.render());
        return this.buttonForm.empty().append(this.confirmButton(), this.abortButton());
      } else {
        this.itemDiv.empty().append($('<em>').text('No compensable items'));
        return this.buttonForm.empty().append(this.continueButton());
      }
    };

    VendorCompensation.prototype.onCancel = function() {
      return this.switcher.switchTo(VendorReport, this.vendor);
    };

    VendorCompensation.prototype.onConfirm = function() {
      var i, j, len, nItems, ref, results;
      this.buttonForm.empty();
      nItems = this.compensableItems.length;
      ref = this.compensableItems;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        i = ref[j];
        results.push(Api.item_compensate({
          code: i.code
        }).done((function(_this) {
          return function() {
            nItems -= 1;
            if (nItems <= 0) {
              return _this.onCompensated();
            }
          };
        })(this)));
      }
      return results;
    };

    VendorCompensation.prototype.onCompensated = function() {
      var i, items, j, len, table;
      items = this.compensableItems;
      this.compensableItems = [];
      for (j = 0, len = items.length; j < len; j++) {
        i = items[j];
        i.state = 'CO';
      }
      table = new ItemReportTable('Compensated Items');
      table.update(items);
      this.itemDiv.empty().append(table.render());
      return this.buttonForm.empty().append(this.continueButton());
    };

    return VendorCompensation;

  })(CheckoutMode);

}).call(this);

// ================ 22: vendorreport.coffee ================

(function() {
  var tables,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  tables = [
    [
      gettext('Compensable Items'), {
        SO: 0
      }, false
    ], [
      gettext('Returnable Items'), {
        BR: 0,
        ST: 0
      }, false
    ], [
      gettext('Other Items'), {
        MI: 0,
        RE: 0,
        CO: 0
      }, false
    ], [
      gettext('Not brought to event'), {
        AD: 0
      }, true
    ]
  ];

  this.VendorReport = (function(superClass) {
    extend(VendorReport, superClass);

    function VendorReport(cfg, switcher, vendor) {
      this.onReturn = bind(this.onReturn, this);
      this.onCompensate = bind(this.onCompensate, this);
      this.onGotItems = bind(this.onGotItems, this);
      VendorReport.__super__.constructor.call(this, cfg, switcher);
      this.vendor = vendor;
    }

    VendorReport.prototype.title = function() {
      return gettext("Item Report");
    };

    VendorReport.prototype.inputPlaceholder = function() {
      return "Search vendor";
    };

    VendorReport.prototype.actions = function() {
      return [
        [
          "", (function(_this) {
            return function(query) {
              return _this.switcher.switchTo(VendorFindMode, query);
            };
          })(this)
        ], [this.cfg.settings.logoutPrefix, this.onLogout]
      ];
    };

    VendorReport.prototype.enter = function() {
      var checkoutButton, compensateButton;
      VendorReport.__super__.enter.apply(this, arguments);
      this.cfg.uiRef.body.append(new VendorInfo(this.vendor).render());
      compensateButton = $('<input type="button">').addClass('btn btn-primary').attr('value', gettext('Compensate')).click(this.onCompensate);
      checkoutButton = $('<input type="button">').addClass('btn btn-primary').attr('value', gettext('Return Items')).click(this.onReturn);
      this.cfg.uiRef.body.append($('<form class="hidden-print">').append(compensateButton, checkoutButton));
      return Api.item_list({
        vendor: this.vendor.id
      }).done(this.onGotItems);
    };

    VendorReport.prototype.onGotItems = function(items) {
      var hidePrint, i, j, len, matchingItems, name, ref, rendered_table, results, states, table;
      results = [];
      for (j = 0, len = tables.length; j < len; j++) {
        ref = tables[j], name = ref[0], states = ref[1], hidePrint = ref[2];
        matchingItems = (function() {
          var k, len1, results1;
          results1 = [];
          for (k = 0, len1 = items.length; k < len1; k++) {
            i = items[k];
            if (states[i.state] != null) {
              results1.push(i);
            }
          }
          return results1;
        })();
        table = new ItemReportTable(name);
        table.update(matchingItems);
        rendered_table = table.render();
        if (hidePrint) {
          rendered_table.addClass('hidden-print');
        }
        results.push(this.cfg.uiRef.body.append(rendered_table));
      }
      return results;
    };

    VendorReport.prototype.onCompensate = function() {
      return this.switcher.switchTo(VendorCompensation, this.vendor);
    };

    VendorReport.prototype.onReturn = function() {
      return this.switcher.switchTo(VendorCheckoutMode, this.vendor);
    };

    return VendorReport;

  })(CheckoutMode);

}).call(this);

// ================ 23: vendorfindmode.coffee ================

(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  this.VendorFindMode = (function(superClass) {
    extend(VendorFindMode, superClass);

    ModeSwitcher.registerEntryPoint("vendor_find", VendorFindMode);

    function VendorFindMode() {
      var args, i, query;
      args = 2 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 1) : (i = 0, []), query = arguments[i++];
      this.onVendorsFound = bind(this.onVendorsFound, this);
      VendorFindMode.__super__.constructor.apply(this, arguments);
      this.vendorList = new VendorList();
      this.query = query;
    }

    VendorFindMode.prototype.enter = function() {
      VendorFindMode.__super__.enter.apply(this, arguments);
      this.cfg.uiRef.body.append(this.vendorList.render());
      if (this.query != null) {
        return Api.vendor_find({
          q: this.query
        }).done(this.onVendorsFound);
      }
    };

    VendorFindMode.prototype.glyph = function() {
      return "user";
    };

    VendorFindMode.prototype.title = function() {
      return "Vendor Search";
    };

    VendorFindMode.prototype.inputPlaceholder = function() {
      return "Search vendor";
    };

    VendorFindMode.prototype.actions = function() {
      return [
        [
          "", (function(_this) {
            return function(query) {
              return Api.vendor_find({
                q: query
              }).done(_this.onVendorsFound);
            };
          })(this)
        ], [this.cfg.settings.logoutPrefix, this.onLogout]
      ];
    };

    VendorFindMode.prototype.onVendorsFound = function(vendors) {
      var i, index_, len, results, vendor_;
      this.vendorList.body.empty();
      results = [];
      for (index_ = i = 0, len = vendors.length; i < len; index_ = ++i) {
        vendor_ = vendors[index_];
        results.push(((function(_this) {
          return function(vendor, index) {
            return _this.vendorList.append(vendor, index + 1, (function() {
              return _this.switcher.switchTo(VendorReport, vendor);
            }));
          };
        })(this))(vendor_, index_));
      }
      return results;
    };

    return VendorFindMode;

  })(CheckoutMode);

}).call(this);

// ================ 24: number_test.coffee ================

(function() {
  var NUM_PAT;

  NUM_PAT = /^-?\d+([,\.]\d*)?$/;

  Number.isConvertible = function(str) {
    return NUM_PAT.test(str);
  };

}).call(this);

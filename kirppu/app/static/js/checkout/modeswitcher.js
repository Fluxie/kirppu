// Generated by CoffeeScript 1.7.1
(function() {
  var setClass;

  setClass = function(element, cls, enabled) {
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
        console.error("Name '" + name + "' was already registered for '" + this.entryPoints[name].name + "' while registering '" + mode.name + "'.");
        return;
      }
      this.entryPoints[name] = mode;
    };

    function ModeSwitcher(config) {
      this.cfg = config ? config : CheckoutConfig;
      this._currentMode = null;
      this._bindMenu(ModeSwitcher.entryPoints);
    }

    ModeSwitcher.prototype.startDefault = function() {
      return this.switchTo(ModeSwitcher.entryPoints["counter_validation"]);
    };

    ModeSwitcher.prototype.switchTo = function(mode) {
      var newMode;
      if (this._currentMode != null) {
        if (!this._currentMode.onPreUnBind()) {
          throw new Error(this._currentMode.name + " refused to stop.");
        }
        this._currentMode.unbind();
        this._currentMode = null;
      }
      newMode = new mode(this, this.cfg);
      if (!newMode.onPreBind()) {
        return;
      }
      newMode.bind();
      newMode.clearReceipt();
      this._currentMode = newMode;
    };

    ModeSwitcher.prototype.currentMode = function() {
      if (this._currentMode != null) {
        return this._currentMode.constructor.name;
      } else {
        return null;
      }
    };

    ModeSwitcher.prototype._bindMenu = function(entryPoints) {
      var entryPoint, entryPointName, item, itemDom, items, menu, _i, _len;
      menu = this.cfg.uiRef.modeMenu;
      items = menu.find("[data-entrypoint]");
      for (_i = 0, _len = items.length; _i < _len; _i++) {
        itemDom = items[_i];
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

    return ModeSwitcher;

  })();

}).call(this);
